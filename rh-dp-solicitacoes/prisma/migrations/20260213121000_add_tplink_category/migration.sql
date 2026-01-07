DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'TPLINK'
      AND enumtypid = '"TiEquipmentCategory"'::regtype
  ) THEN
    ALTER TYPE "TiEquipmentCategory" ADD VALUE 'TPLINK';
  END IF;
END $$;