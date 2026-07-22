-- Migration: adiciona coluna status_documento em pedidos
ALTER TABLE pedidos
  ADD COLUMN status_documento ENUM('ORCAMENTO','PEDIDO') NOT NULL DEFAULT 'ORCAMENTO';

-- Nota: execute este arquivo com seu gerenciador de migrations ou manualmente no DB.
