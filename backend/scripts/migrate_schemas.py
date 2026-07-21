import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app.models.orm import Base, ContentObjective, ContentScenario

# Force override because VS Code tasks.json cache might interfere
load_dotenv(override=True)
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL not found.")
    sys.exit(1)

engine = create_engine(db_url)
SessionLocal = sessionmaker(bind=engine)

def migrate_objectives(session):
    print("Migrating ContentObjectives...")
    objectives = session.query(ContentObjective).all()
    count = 0
    for obj in objectives:
        data = dict(obj.data)
        changed = False

        # Remove old keys
        for key in ['completion_rules', 'completion_rule', 'tags', 'keywords', 'intent']:
            if key in data:
                del data[key]
                changed = True

        # Ensure priority is a float around 0 to 1, default 0.7
        if 'priority' not in data or not isinstance(data['priority'], (int, float)):
            data['priority'] = 0.7
            changed = True
            
        # Add new keys if missing
        if 'urgency' not in data:
            data['urgency'] = 'low'
            changed = True
        if 'success_conditions' not in data:
            data['success_conditions'] = []
            changed = True
        if 'failure_conditions' not in data:
            data['failure_conditions'] = []
            changed = True
        if 'allowed_strategies' not in data:
            data['allowed_strategies'] = []
            changed = True
        if 'constraints' not in data:
            data['constraints'] = []
            changed = True

        if changed:
            obj.data = data
            # SQLAlchemy needs to know the json changed if it's mutating in place
            # but since we reassigned obj.data = data, it should trigger the update
            count += 1
            
    print(f"Updated {count} objectives.")


def migrate_scenarios(session):
    print("Migrating ContentScenarios...")
    scenarios = session.query(ContentScenario).all()
    count = 0
    for scenario in scenarios:
        data = dict(scenario.data)
        changed = False

        if 'stage_sequence' in data:
            new_seq = []
            for step in data['stage_sequence']:
                new_step = dict(step)
                # Migrate objectives -> mandatory_objectives and optional_objectives
                if 'objectives' in new_step:
                    new_step['mandatory_objectives'] = new_step.pop('objectives')
                    new_step['optional_objectives'] = []
                    changed = True
                
                # Ensure they exist just in case
                if 'mandatory_objectives' not in new_step:
                    new_step['mandatory_objectives'] = []
                    changed = True
                if 'optional_objectives' not in new_step:
                    new_step['optional_objectives'] = []
                    changed = True
                if 'constraints' not in new_step:
                    new_step['constraints'] = []
                    changed = True
                    
                new_seq.append(new_step)
            
            if changed:
                data['stage_sequence'] = new_seq
                scenario.data = data
                count += 1
                
    print(f"Updated {count} scenarios.")


def main():
    print(f"Connecting to DB: {db_url}")
    session = SessionLocal()
    try:
        migrate_objectives(session)
        migrate_scenarios(session)
        session.commit()
        print("Migration complete.")
    except Exception as e:
        session.rollback()
        print(f"Migration failed: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
