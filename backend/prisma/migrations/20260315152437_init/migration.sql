-- CreateTable
CREATE TABLE "councils" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "platform_type" TEXT NOT NULL,
    "api_endpoint" TEXT,
    "last_scraped_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "councils_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_zones" (
    "id" TEXT NOT NULL,
    "council_id" TEXT NOT NULL,
    "zone_name" TEXT NOT NULL,
    "zone_code" TEXT,
    "general_day" TEXT NOT NULL,
    "general_frequency" TEXT NOT NULL DEFAULT 'weekly',
    "recycling_day" TEXT NOT NULL,
    "recycling_week" TEXT NOT NULL,
    "green_waste_day" TEXT,
    "green_waste_week" TEXT,
    "verge_dates" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_cache" (
    "id" TEXT NOT NULL,
    "address_string" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "council_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "cached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "push_token" TEXT,
    "notification_hour" INTEGER NOT NULL DEFAULT 18,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscription_status" TEXT NOT NULL DEFAULT 'free',
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_zones" (
    "user_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "address_label" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_zones_pkey" PRIMARY KEY ("user_id","zone_id")
);

-- CreateTable
CREATE TABLE "wa_public_holidays" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift_days" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "wa_public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "councils_slug_key" ON "councils"("slug");

-- CreateIndex
CREATE INDEX "address_cache_address_string_idx" ON "address_cache"("address_string");

-- CreateIndex
CREATE INDEX "user_zones_zone_id_idx" ON "user_zones"("zone_id");

-- AddForeignKey
ALTER TABLE "collection_zones" ADD CONSTRAINT "collection_zones_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "councils"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_cache" ADD CONSTRAINT "address_cache_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "councils"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_cache" ADD CONSTRAINT "address_cache_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "collection_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_zones" ADD CONSTRAINT "user_zones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_zones" ADD CONSTRAINT "user_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "collection_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
