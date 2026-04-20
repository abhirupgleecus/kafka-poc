from pydantic import BaseModel

class UPCRequest(BaseModel):
    upc: str