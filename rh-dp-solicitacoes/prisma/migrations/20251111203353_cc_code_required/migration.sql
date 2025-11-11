/*
  Warnings:

  - The values [ATIVADO,INATIVO] on the enum `CCStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `groupName` on the `CostCenter` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `CostCenter` table. All the data in the column will be lost.
  - Made the column `code` on table `CostCenter` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- 1) backfill: gera código para qualquer linha que ainda esteja NULL
-- use esta versão que não depende de extensões:
update "CostCenter"
set "code" = 'CC-' || substr(md5(random()::text), 1, 6)
where "code" is null;

-- 2) garante índice unique (caso ainda não exista)
do $$ begin
  if not exists (
    select 1 from pg_indexes
    where indexname = 'CostCenter_code_key'
  ) then
    create unique index "CostCenter_code_key" on "CostCenter"("code");
  end if;
end $$;

-- 3) agora pode travar como NOT NULL com segurança
alter table "CostCenter"
  alter column "code" set not null;
