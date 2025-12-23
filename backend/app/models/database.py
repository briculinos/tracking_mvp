from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Float, DateTime
from datetime import datetime
from typing import AsyncGenerator

DATABASE_URL = "sqlite+aiosqlite:///./tracking.db"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class ZoneModel(Base):
    __tablename__ = "zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    store_id: Mapped[int] = mapped_column(Integer, index=True)
    floor: Mapped[int] = mapped_column(Integer, default=0)
    x1: Mapped[float] = mapped_column(Float)
    y1: Mapped[float] = mapped_column(Float)
    x2: Mapped[float] = mapped_column(Float)
    y2: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FloorPlanModel(Base):
    __tablename__ = "floorplans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(Integer, index=True)
    floor: Mapped[int] = mapped_column(Integer, default=0)
    filename: Mapped[str] = mapped_column(String(255))
    data_min_x: Mapped[float] = mapped_column(Float, default=0.0)
    data_max_x: Mapped[float] = mapped_column(Float, default=100.0)
    data_min_y: Mapped[float] = mapped_column(Float, default=0.0)
    data_max_y: Mapped[float] = mapped_column(Float, default=100.0)
    image_width: Mapped[int] = mapped_column(Integer, default=1000)
    image_height: Mapped[int] = mapped_column(Integer, default=1000)
    # Visual adjustments for floor plan overlay
    adjust_offset_x: Mapped[float] = mapped_column(Float, default=0.0)
    adjust_offset_y: Mapped[float] = mapped_column(Float, default=0.0)
    adjust_scale: Mapped[float] = mapped_column(Float, default=1.0)
    adjust_rotation: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class StoreModel(Base):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    country: Mapped[str] = mapped_column(String(100))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
