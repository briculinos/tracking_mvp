from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import BigQueryServiceDep, SettingsDep
from app.models.database import get_db, StoreModel
from app.models.schemas import Store, StoreListResponse

router = APIRouter()


@router.get("/test/connection")
async def test_bigquery_connection(bq_service: BigQueryServiceDep):
    """Test BigQuery connection"""
    return await bq_service.test_connection()


@router.get("", response_model=StoreListResponse)
async def list_stores(
    bq_service: BigQueryServiceDep,
    db: AsyncSession = Depends(get_db)
):
    """List all stores with country information"""
    # Get stores from BigQuery
    bq_stores = await bq_service.get_stores()

    # Get store metadata from local DB
    result = await db.execute(select(StoreModel))
    store_metadata = {s.id: s for s in result.scalars().all()}

    stores = []
    for bq_store in bq_stores:
        store_id = bq_store["store_id"]
        metadata = store_metadata.get(store_id)

        # Get floors for this store
        floors = await bq_service.get_store_floors(store_id)

        stores.append(Store(
            store_id=store_id,
            name=metadata.name if metadata else f"Store {store_id}",
            country=metadata.country if metadata else "Unknown",
            floors=floors
        ))

    return StoreListResponse(stores=stores)


@router.get("/{store_id}")
async def get_store(
    store_id: int,
    bq_service: BigQueryServiceDep,
    db: AsyncSession = Depends(get_db)
):
    """Get store details"""
    # Get store metadata
    result = await db.execute(select(StoreModel).where(StoreModel.id == store_id))
    metadata = result.scalar_one_or_none()

    # Get floors
    floors = await bq_service.get_store_floors(store_id)

    return {
        "store_id": store_id,
        "name": metadata.name if metadata else f"Store {store_id}",
        "country": metadata.country if metadata else "Unknown",
        "floors": floors
    }


@router.post("/{store_id}/metadata")
async def update_store_metadata(
    store_id: int,
    name: str,
    country: str,
    db: AsyncSession = Depends(get_db)
):
    """Update store metadata (name, country)"""
    result = await db.execute(select(StoreModel).where(StoreModel.id == store_id))
    store = result.scalar_one_or_none()

    if store:
        store.name = name
        store.country = country
    else:
        store = StoreModel(id=store_id, name=name, country=country)
        db.add(store)

    await db.commit()
    await db.refresh(store)

    return {
        "store_id": store.id,
        "name": store.name,
        "country": store.country
    }


@router.get("/{store_id}/floors")
async def get_store_floors(
    store_id: int,
    bq_service: BigQueryServiceDep
):
    """Get available floors for a store"""
    floors = await bq_service.get_store_floors(store_id)
    return {"store_id": store_id, "floors": floors}
