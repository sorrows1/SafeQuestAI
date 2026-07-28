from __future__ import annotations
import hashlib,secrets
from collections import defaultdict,deque
from datetime import datetime,timedelta,timezone
from fastapi import APIRouter,Depends,HTTPException,Query,status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.auth.security import get_current_user
from app.config.rollout import FeatureFlag, require_feature
from app.telemetry import record as telemetry_record
from app.models.orm import FamilyRelationship,FamilyRelationshipAuditEvent,FamilyRelationshipInvitation,FamilySession,FamilySessionEvent,FamilySessionParticipant,User,get_db
from app.models.schemas import FamilyAuthorizedSessionOut,FamilyRelationshipInvitationAcceptRequest,FamilyRelationshipInvitationCreateRequest,FamilyRelationshipInvitationOut,FamilyRelationshipOut,FamilyRelationshipPreviewOut,FamilyRelationshipUpdateRequest,FamilyRole,ScenarioLifecycle,TERMINAL_FAMILY_SESSION_STATES,catalog_lifecycle_for_states

def require_relationships_rollout() -> None:
    require_feature(FeatureFlag.RELATIONSHIPS)


router=APIRouter(prefix="/api/family",tags=["Family Linking"], dependencies=[Depends(require_relationships_rollout)])
TTL=timedelta(days=7); WINDOW=timedelta(minutes=10); MAX=12
attempts: dict[str,deque[datetime]]=defaultdict(deque)
def now(): return datetime.now(timezone.utc)
def stamp(v): return v.isoformat() if v else None
def ref(prefix): return f"{prefix}_{secrets.token_urlsafe(18)}"
def digest(v): return hashlib.sha256(v.strip().encode()).hexdigest()
def member_ref(user_id): return "member_"+hashlib.sha256(f"safequest-member:{user_id}".encode()).hexdigest()[:20]
def invalid():
    telemetry_record("invitation.failure", reason="unavailable")
    return HTTPException(404,"This invitation is unavailable or has expired")
def limit(action,user_id):
    key=f"{action}:{user_id}"; q=attempts[key]; point=now()
    while q and point-q[0]>WINDOW:q.popleft()
    if len(q)>=MAX: raise HTTPException(429,"Please wait before trying another invitation")
    q.append(point)
def audit(db,action,actor,invitation=None,relationship=None):
    db.add(FamilyRelationshipAuditEvent(actor_user_id=actor.id,action=action,invitation_id=invitation.id if invitation else None,relationship_id=relationship.id if relationship else None,metadata_json={}))
def invite_out(row,token=None,code=None,viewer_id=None):
    inviter_role = FamilyRole(row.inviter_role or "caregiver")
    intended_role = FamilyRole(row.intended_role or ("learner" if inviter_role is FamilyRole.CAREGIVER else "caregiver"))
    direction = None
    if viewer_id is not None:
        direction = "sent" if (row.inviter_user_id or row.caregiver_user_id) == viewer_id else "received"
    return FamilyRelationshipInvitationOut(invitation_ref=row.public_id or "",status=row.status,expires_at=stamp(row.expires_at) or "",created_at=stamp(row.created_at) or "",delivery_label=row.delivery_label,token=token,short_code=code,inviter_role=inviter_role,intended_role=intended_role,direction=direction)
def find_secret(db,secret):
    key=digest(secret)
    return db.query(FamilyRelationshipInvitation).filter(or_(FamilyRelationshipInvitation.token_hash==key,FamilyRelationshipInvitation.short_code_hash==key)).first()
def session_participant(session,user_id,db):
    return db.query(FamilySessionParticipant).filter(FamilySessionParticipant.family_session_id==session.id,FamilySessionParticipant.user_id==user_id,FamilySessionParticipant.left_at.is_(None),FamilySessionParticipant.presence_status != "pending").first()
def active_relationship_for_ref(db,relationship_ref,user_id):
    row=db.query(FamilyRelationship).filter(FamilyRelationship.public_id==relationship_ref,FamilyRelationship.status=="active",FamilyRelationship.revoked_at.is_(None),or_(FamilyRelationship.caregiver_user_id==user_id,FamilyRelationship.learner_user_id==user_id)).first()
    if not row: raise HTTPException(404,"Family relationship not found")
    return row
def relation_out(row,user,db):
    if user.id==row.caregiver_user_id: member_id,role=row.learner_user_id,FamilyRole.CAREGIVER
    else: member_id,role=row.caregiver_user_id,FamilyRole.LEARNER
    member=db.get(User,member_id)
    return FamilyRelationshipOut(relationship_ref=row.public_id or "",role=role,viewer_role=role,member_role=(FamilyRole.LEARNER if role is FamilyRole.CAREGIVER else FamilyRole.CAREGIVER),member_ref=member_ref(member_id),member_display_name=member.display_name if member else "Family member",member_avatar_url=member.avatar_url if member else None,accepted_at=stamp(row.accepted_at) or "",status=row.status)

@router.post("/invitations",response_model=FamilyRelationshipInvitationOut,status_code=status.HTTP_201_CREATED)
def create_invitation(body:FamilyRelationshipInvitationCreateRequest,db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    limit("create",current_user.id); email=body.learner_email.strip().casefold()
    inviter_role = body.family_role
    intended_role = FamilyRole.LEARNER if inviter_role is FamilyRole.CAREGIVER else FamilyRole.CAREGIVER
    if email==current_user.email.casefold(): raise HTTPException(422,"You cannot create a family link to your own account")
    db.query(FamilyRelationshipInvitation).filter(FamilyRelationshipInvitation.inviter_user_id == current_user.id, FamilyRelationshipInvitation.recipient_email == email, FamilyRelationshipInvitation.status == "pending", FamilyRelationshipInvitation.expires_at <= now()).update({"status": "expired"}, synchronize_session=False)
    duplicate = db.query(FamilyRelationshipInvitation).filter(FamilyRelationshipInvitation.inviter_user_id == current_user.id, FamilyRelationshipInvitation.recipient_email == email, FamilyRelationshipInvitation.inviter_role == inviter_role.value, FamilyRelationshipInvitation.intended_role == intended_role.value, FamilyRelationshipInvitation.status == "pending", FamilyRelationshipInvitation.expires_at > now()).first()
    if duplicate: raise HTTPException(409, "A pending invitation already exists; revoke it before creating another")
    recipient = db.query(User).filter(User.email == email).first()
    if recipient:
        low, high = sorted((current_user.id, recipient.id))
        if db.query(FamilyRelationship).filter(FamilyRelationship.user_low_id == low, FamilyRelationship.user_high_id == high, FamilyRelationship.status == "active").first(): raise HTTPException(409, "An active family relationship already exists")
    token,code=secrets.token_urlsafe(32),"".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
    row=FamilyRelationshipInvitation(public_id=ref("fi"),caregiver_user_id=current_user.id if inviter_role is FamilyRole.CAREGIVER else None,inviter_user_id=current_user.id,learner_email=email if intended_role is FamilyRole.LEARNER else None,recipient_email=email,inviter_role=inviter_role.value,intended_role=intended_role.value,token_hash=digest(token),short_code_hash=digest(code),expires_at=now()+TTL,status="pending",delivery_label=body.delivery_label)
    db.add(row); audit(db, "invitation_created", current_user, row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        duplicate = db.query(FamilyRelationshipInvitation).filter(FamilyRelationshipInvitation.inviter_user_id == current_user.id, FamilyRelationshipInvitation.recipient_email == email, FamilyRelationshipInvitation.inviter_role == inviter_role.value, FamilyRelationshipInvitation.intended_role == intended_role.value, FamilyRelationshipInvitation.status == "pending").first()
        if duplicate:
            raise HTTPException(409, "A pending invitation already exists; revoke it before creating another")
        raise
    db.refresh(row); telemetry_record("invitation.success", status="created"); return invite_out(row, token, code, current_user.id)

@router.get("/invitations",response_model=list[FamilyRelationshipInvitationOut])
def list_invitations(db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    rows=db.query(FamilyRelationshipInvitation).filter(or_(FamilyRelationshipInvitation.inviter_user_id==current_user.id,FamilyRelationshipInvitation.caregiver_user_id==current_user.id,FamilyRelationshipInvitation.recipient_email==current_user.email.casefold(),FamilyRelationshipInvitation.learner_email==current_user.email.casefold())).order_by(FamilyRelationshipInvitation.created_at.desc()).all()
    return [invite_out(row,viewer_id=current_user.id) for row in rows]

@router.get("/invitations/preview",response_model=FamilyRelationshipPreviewOut)
def preview(secret:str=Query(min_length=6,max_length=512),db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    limit("preview",current_user.id); row=find_secret(db,secret)
    if not row or row.status!="pending" or row.expires_at<=now() or (row.recipient_email or row.learner_email)!=current_user.email.casefold(): raise invalid()
    inviter=db.get(User,row.inviter_user_id or row.caregiver_user_id)
    if not inviter or not inviter.is_active or inviter.id==current_user.id: raise invalid()
    return FamilyRelationshipPreviewOut(invitation_ref=row.public_id or "",inviter_display_name=inviter.display_name,expires_at=stamp(row.expires_at) or "",sharing_summary="Linking only enables explicitly shared sessions. It does not reveal private companion chats, disclosure flags, email, or past activity.")

def consume(body,db,user,action):
    limit(action,user.id); row=find_secret(db,body.secret)
    if not row or row.status!="pending" or row.expires_at<=now() or (row.recipient_email or row.learner_email)!=user.email.casefold(): raise invalid()
    return row

@router.post("/invitations/accept",response_model=FamilyRelationshipOut)
def accept(body:FamilyRelationshipInvitationAcceptRequest,db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    row=consume(body,db,current_user,"accept"); row.accept_attempt_count+=1;row.last_attempt_at=now(); inviter=db.get(User,row.inviter_user_id or row.caregiver_user_id)
    if not inviter or not inviter.is_active or inviter.id==current_user.id: row.failed_lookup_count+=1;db.commit();raise invalid()
    if row.inviter_role == FamilyRole.CAREGIVER.value:
        caregiver, learner = inviter, current_user
    else:
        caregiver, learner = current_user, inviter
    low,high=sorted((caregiver.id,learner.id)); existing=db.query(FamilyRelationship).filter(FamilyRelationship.user_low_id==low,FamilyRelationship.user_high_id==high).first()
    if existing and existing.status=="active": row.status="accepted";row.accepted_at=now();row.accepted_by_user_id=current_user.id;audit(db,"invitation_replayed",current_user,row,existing);db.commit();return relation_out(existing,current_user,db)
    if existing and existing.status=="blocked": row.failed_lookup_count+=1;db.commit();raise invalid()
    row.status="accepted";row.accepted_at=now();row.accepted_by_user_id=current_user.id
    if existing:
        existing.caregiver_user_id=caregiver.id;existing.learner_user_id=learner.id;existing.invitation_id=row.id;existing.accepted_at=now();existing.revoked_at=None;existing.status="active";existing.blocked_by_user_id=None
        audit(db,"relationship_relinked",current_user,row,existing);db.commit();return relation_out(existing,current_user,db)
    relationship=FamilyRelationship(public_id=ref("fr"),caregiver_user_id=caregiver.id,learner_user_id=learner.id,user_low_id=low,user_high_id=high,invitation_id=row.id,source="invitation",accepted_at=now(),status="active")
    db.add(relationship);audit(db,"invitation_accepted",current_user,row,relationship)
    try: db.commit()
    except IntegrityError:
        db.rollback(); existing=db.query(FamilyRelationship).filter(FamilyRelationship.user_low_id==low,FamilyRelationship.user_high_id==high,FamilyRelationship.status=="active").first()
        if not existing: raise
        return relation_out(existing,current_user,db)
    db.refresh(relationship);telemetry_record("invitation.success", status="accepted");return relation_out(relationship,current_user,db)

@router.post("/invitations/decline",status_code=status.HTTP_204_NO_CONTENT)
def decline(body:FamilyRelationshipInvitationAcceptRequest,db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    row=consume(body,db,current_user,"decline");row.status="declined";audit(db,"invitation_declined",current_user,row);db.commit()

@router.post("/invitations/{invitation_ref}/accept-as-recipient",response_model=FamilyRelationshipOut)
def accept_as_recipient(invitation_ref:str,db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    """Accept an invitation without requiring the secret — uses authenticated user's email."""
    limit("accept",current_user.id)
    row=db.query(FamilyRelationshipInvitation).filter(FamilyRelationshipInvitation.public_id==invitation_ref,FamilyRelationshipInvitation.status=="pending",FamilyRelationshipInvitation.expires_at>now()).first()
    if not row or (row.recipient_email or row.learner_email)!=current_user.email.casefold(): raise invalid()
    row.accept_attempt_count+=1;row.last_attempt_at=now()
    inviter=db.get(User,row.inviter_user_id or row.caregiver_user_id)
    if not inviter or not inviter.is_active or inviter.id==current_user.id: row.failed_lookup_count+=1;db.commit();raise invalid()
    if row.inviter_role == FamilyRole.CAREGIVER.value:
        caregiver, learner = inviter, current_user
    else:
        caregiver, learner = current_user, inviter
    low,high=sorted((caregiver.id,learner.id))
    existing=db.query(FamilyRelationship).filter(FamilyRelationship.user_low_id==low,FamilyRelationship.user_high_id==high).first()
    if existing and existing.status=="active": row.status="accepted";row.accepted_at=now();row.accepted_by_user_id=current_user.id;audit(db,"invitation_replayed",current_user,row,existing);db.commit();return relation_out(existing,current_user,db)
    if existing and existing.status=="blocked": row.failed_lookup_count+=1;db.commit();raise invalid()
    row.status="accepted";row.accepted_at=now();row.accepted_by_user_id=current_user.id
    if existing:
        existing.caregiver_user_id=caregiver.id;existing.learner_user_id=learner.id;existing.invitation_id=row.id;existing.accepted_at=now();existing.revoked_at=None;existing.status="active";existing.blocked_by_user_id=None
        audit(db,"relationship_relinked",current_user,row,existing);db.commit();return relation_out(existing,current_user,db)
    relationship=FamilyRelationship(public_id=ref("fr"),caregiver_user_id=caregiver.id,learner_user_id=learner.id,user_low_id=low,user_high_id=high,invitation_id=row.id,source="invitation",accepted_at=now(),status="active")
    db.add(relationship);audit(db,"invitation_accepted",current_user,row,relationship)
    try: db.commit()
    except IntegrityError:
        db.rollback(); existing=db.query(FamilyRelationship).filter(FamilyRelationship.user_low_id==low,FamilyRelationship.user_high_id==high,FamilyRelationship.status=="active").first()
        if not existing: raise
        return relation_out(existing,current_user,db)
    db.refresh(relationship);telemetry_record("invitation.success", status="accepted");return relation_out(relationship,current_user,db)

@router.post("/invitations/{invitation_ref}/decline-as-recipient",status_code=status.HTTP_204_NO_CONTENT)
def decline_as_recipient(invitation_ref:str,db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    """Decline an invitation without requiring the secret — uses authenticated user's email."""
    limit("decline",current_user.id)
    row=db.query(FamilyRelationshipInvitation).filter(FamilyRelationshipInvitation.public_id==invitation_ref,FamilyRelationshipInvitation.status=="pending",FamilyRelationshipInvitation.expires_at>now()).first()
    if not row or (row.recipient_email or row.learner_email)!=current_user.email.casefold(): raise invalid()
    row.status="declined";audit(db,"invitation_declined",current_user,row);db.commit()

@router.post("/invitations/{invitation_ref}/revoke",status_code=status.HTTP_204_NO_CONTENT)
def revoke(invitation_ref:str,db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    row=db.query(FamilyRelationshipInvitation).filter(FamilyRelationshipInvitation.public_id==invitation_ref,or_(FamilyRelationshipInvitation.caregiver_user_id==current_user.id,FamilyRelationshipInvitation.inviter_user_id==current_user.id),FamilyRelationshipInvitation.status=="pending").first()
    if not row: raise invalid()
    row.status="revoked";row.revoked_at=now();audit(db,"invitation_revoked",current_user,row);db.commit()

@router.get("/relationships",response_model=list[FamilyRelationshipOut])
def relationships(db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    rows=db.query(FamilyRelationship).filter(or_(FamilyRelationship.caregiver_user_id==current_user.id,FamilyRelationship.learner_user_id==current_user.id)).order_by(FamilyRelationship.accepted_at.desc()).all()
    return [relation_out(row,current_user,db) for row in rows]

@router.patch("/relationships/{relationship_ref}",response_model=FamilyRelationshipOut)
def update_relationship(relationship_ref:str,body:FamilyRelationshipUpdateRequest,db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    row=db.query(FamilyRelationship).filter(FamilyRelationship.public_id==relationship_ref,or_(FamilyRelationship.caregiver_user_id==current_user.id,FamilyRelationship.learner_user_id==current_user.id),FamilyRelationship.status=="active").first()
    if not row: raise HTTPException(404,"Family relationship not found")
    point=now();row.status="blocked" if body.action=="block" else "revoked";row.revoked_at=point;row.blocked_by_user_id=current_user.id if body.action=="block" else None
    # Default Phase 8 policy: revoke future/live caregiver access, retain completed guides.
    live=db.query(FamilySession).filter(FamilySession.child_user_id==row.learner_user_id,FamilySession.parent_user_id==row.caregiver_user_id,FamilySession.state.notin_(TERMINAL_FAMILY_SESSION_STATES)).all()
    for session in live:
        member=db.query(FamilySessionParticipant).filter(FamilySessionParticipant.family_session_id==session.id,FamilySessionParticipant.user_id==row.caregiver_user_id,FamilySessionParticipant.left_at.is_(None)).first()
        if not member: continue
        member.left_at=point;member.presence_status="left";member.presence_expires_at=None
        session.event_sequence=(session.event_sequence or 0)+1
        db.add(FamilySessionEvent(family_session_id=session.id,sequence=session.event_sequence,event_type="participant_left",actor_participant_id=member.id,payload={"member_ref":member_ref(member.user_id),"reason":"relationship_revoked"},is_ephemeral=False))
    audit(db,"relationship_"+body.action,current_user,relationship=row);db.commit();return relation_out(row,current_user,db)

@router.get("/sessions",response_model=list[FamilyAuthorizedSessionOut])
def authorized_sessions(db:Session=Depends(get_db),current_user:User=Depends(get_current_user)):
    rows=db.query(FamilySession,FamilySessionParticipant).join(FamilySessionParticipant,FamilySessionParticipant.family_session_id==FamilySession.id).filter(FamilySessionParticipant.user_id==current_user.id,FamilySessionParticipant.left_at.is_(None)).all()
    return [FamilyAuthorizedSessionOut(session_ref=session.public_id or "",transcript_id=session.transcript_id,state=session.state,role=FamilyRole(member.role),owner_ref=member_ref(session.owner_user_id or session.child_user_id),started_at=stamp(session.started_at) or "",completed_at=stamp(session.completed_at),lifecycle=ScenarioLifecycle(catalog_lifecycle_for_states([session.state]))) for session,member in rows]
