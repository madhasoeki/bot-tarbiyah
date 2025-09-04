-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "username" TEXT,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarbiyah_records" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "tahajud" BOOLEAN NOT NULL DEFAULT false,
    "qobliyah_subuh" BOOLEAN NOT NULL DEFAULT false,
    "subuh" BOOLEAN NOT NULL DEFAULT false,
    "dhuha" BOOLEAN NOT NULL DEFAULT false,
    "qobliyah_dzuhur" BOOLEAN NOT NULL DEFAULT false,
    "dzuhur" BOOLEAN NOT NULL DEFAULT false,
    "badiah_dzuhur" BOOLEAN NOT NULL DEFAULT false,
    "qobliyah_ashar" BOOLEAN NOT NULL DEFAULT false,
    "ashar" BOOLEAN NOT NULL DEFAULT false,
    "maghrib" BOOLEAN NOT NULL DEFAULT false,
    "badiah_maghrib" BOOLEAN NOT NULL DEFAULT false,
    "qobliyah_isya" BOOLEAN NOT NULL DEFAULT false,
    "isya" BOOLEAN NOT NULL DEFAULT false,
    "badiah_isya" BOOLEAN NOT NULL DEFAULT false,
    "odoj" BOOLEAN NOT NULL DEFAULT false,
    "nafs" BOOLEAN NOT NULL DEFAULT false,
    "baca_arti_quran" BOOLEAN NOT NULL DEFAULT false,
    "infaq_subuh" BOOLEAN NOT NULL DEFAULT false,
    "istighfar" BOOLEAN NOT NULL DEFAULT false,
    "sholawat" BOOLEAN NOT NULL DEFAULT false,
    "buzzer" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarbiyah_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "tarbiyah_records_user_id_date_key" ON "tarbiyah_records"("user_id", "date");

-- AddForeignKey
ALTER TABLE "tarbiyah_records" ADD CONSTRAINT "tarbiyah_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
