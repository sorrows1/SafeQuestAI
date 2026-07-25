"""Local safety classifier and PII redaction for every companion child message."""
import re

_HYPOTHETICAL = re.compile(r"\b(?:what if|if someone|in (?:this|the) scenario|pretend|hypothetical|would|could|might)\b", re.I)
_DISCLOSURE = re.compile(
    r"\b(?:this|it)\s+(?:happened|is happening)\s+to me\b|"
    r"\b(?:someone|he|she|they)\s+(?:sent|asked|told|shared|threatened|pressured|hurt|blackmailed|made)\s+me\b|"
    r"\b(?:i|my)\s+(?:was|am|got|have been|feel|felt)\s+(?:scared|unsafe|afraid|pressured|threatened|hurt|embarrassed)\b|"
    r"\b(?:i don't feel safe|i do not feel safe|please don't tell)\b|"
    r"\bmy\s+(?:parent|mom|mum|dad|caregiver|guardian)\s+(?:is|was)\s+(?:hurting|scaring|threatening|pressuring)\s+me\b", re.I)
_EXPLICIT = re.compile(r"\b(?:nude|nudes|naked|sexual|sex(?:ting)?|explicit (?:photo|image|picture))\b", re.I)
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b")
_PHONE = re.compile(r"\b(?:\+?\d[\d .()\-]{7,}\d)\b")
_ADDRESS = re.compile(r"\b\d{1,5}\s+[A-Za-z0-9.' -]+\s(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|court|ct\.?)\b", re.I)
_IDENTITY = re.compile(r"\b(?:my name is|i am|i'm)\s+[A-Z][a-z]{1,30}\b")
_SCHOOL = re.compile(r"\b(?:i go to|my school is)\s+[^.!?]{1,80}\b", re.I)
_EXACT_AGE = re.compile(r"\b(?:i am|i'm)\s+\d{1,2}\s*(?:years? old|yo)\b", re.I)

def is_real_disclosure(text: str) -> bool:
    """Conservative local classifier; every message is checked before an LLM call."""
    return bool(_DISCLOSURE.search(text)) and not bool(_HYPOTHETICAL.search(text))

def contains_explicit_content(text: str) -> bool:
    return bool(_EXPLICIT.search(text))

def redact_personal_info(text: str) -> str:
    text = _EMAIL.sub("[contact detail removed]", text)
    text = _PHONE.sub("[contact detail removed]", text)
    text = _ADDRESS.sub("[address removed]", text)
    text = _SCHOOL.sub("[school detail removed]", text)
    text = _EXACT_AGE.sub("[age detail removed]", text)
    return _IDENTITY.sub("[personal detail removed]", text)

_ROLEPLAY = re.compile(r"\b(?:be|pretend to be|act as|voice)\s+(?:alex|the bully|the scammer|the groomer|the requester)\b", re.I)
def requests_antagonist_roleplay(text: str) -> bool:
    return bool(_ROLEPLAY.search(text))
