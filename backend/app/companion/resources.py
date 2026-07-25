"""Category support resources shared with the family help-seeking beat."""
from app.models.schemas import SupportResourceOut

_RESOURCES = {
    "cyberbullying": SupportResourceOut(label="StopBullying.gov", href="https://www.stopbullying.gov/"),
    "scam": SupportResourceOut(label="FTC ReportFraud", href="https://reportfraud.ftc.gov/"),
    "grooming": SupportResourceOut(label="NCMEC CyberTipline", href="https://www.missingkids.org/gethelpnow/cybertipline"),
    "image_request": SupportResourceOut(label="NCMEC CyberTipline", href="https://www.missingkids.org/gethelpnow/cybertipline"),
    "oversharing": SupportResourceOut(label="NCMEC CyberTipline", href="https://www.missingkids.org/gethelpnow/cybertipline"),
}
def resources_for(category: str) -> list[SupportResourceOut]:
    return [_RESOURCES.get(category, _RESOURCES["oversharing"])]
