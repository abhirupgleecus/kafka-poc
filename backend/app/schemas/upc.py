from pydantic import BaseModel

from app.services.condition_service import (
    AGE_OF_PRODUCT_OPTIONS,
    COMPLETENESS_OPTIONS,
    FUNCTIONAL_STATUS_OPTIONS,
    PHYSICAL_CONDITION_OPTIONS,
)


class ProductAssessment(BaseModel):
    physical_condition: str
    functional_status: str
    completeness: str
    age_of_product: str

    def model_post_init(self, __context) -> None:
        if self.physical_condition not in PHYSICAL_CONDITION_OPTIONS:
            raise ValueError("Invalid physical_condition option.")
        if self.functional_status not in FUNCTIONAL_STATUS_OPTIONS:
            raise ValueError("Invalid functional_status option.")
        if self.completeness not in COMPLETENESS_OPTIONS:
            raise ValueError("Invalid completeness option.")
        if self.age_of_product not in AGE_OF_PRODUCT_OPTIONS:
            raise ValueError("Invalid age_of_product option.")


class UPCRequest(BaseModel):
    upc: str


class AssessmentRequest(BaseModel):
    upc: str
    run_id: str
    assessment: ProductAssessment
