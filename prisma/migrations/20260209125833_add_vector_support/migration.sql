-- CreateTable
CREATE TABLE "document_chunks" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "embedding" vector(3072) NOT NULL,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);
