from pydantic import BaseModel

class ReplayRequest(BaseModel):
    upc: str
    run_id: str


class RerunRequest(BaseModel):
    upc: str
    run_id: str
