/*
  Warnings:

  - A unique constraint covering the columns `[title]` on the table `differentiators` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "differentiators_title_key" ON "differentiators"("title");
