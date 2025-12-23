from typing import Annotated
from fastapi import Depends
from google.cloud import bigquery

from app.config import Settings, get_settings
from app.services.bigquery import BigQueryService


def get_bigquery_service(
    settings: Annotated[Settings, Depends(get_settings)]
) -> BigQueryService:
    return BigQueryService(settings)


BigQueryServiceDep = Annotated[BigQueryService, Depends(get_bigquery_service)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
