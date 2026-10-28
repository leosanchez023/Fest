SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'telefone'
);
SET @sql_add := IF(@column_exists = 0, 'ALTER TABLE usuario ADD COLUMN telefone VARCHAR(30) NULL AFTER email', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'cpf'
);
SET @sql_add := IF(@column_exists = 0, 'ALTER TABLE usuario ADD COLUMN cpf VARCHAR(11) NULL AFTER telefone', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'nascimento'
);
SET @sql_add := IF(@column_exists = 0, 'ALTER TABLE usuario ADD COLUMN nascimento DATE NULL AFTER cpf', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'cargo'
);
SET @sql_add := IF(@column_exists = 0, 'ALTER TABLE usuario ADD COLUMN cargo VARCHAR(100) NULL AFTER nascimento', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'ativo'
);
SET @sql_add := IF(@column_exists = 0, 'ALTER TABLE usuario ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1 AFTER cargo', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'login_habilitado'
);
SET @sql_add := IF(@column_exists = 0, 'ALTER TABLE usuario ADD COLUMN login_habilitado TINYINT(1) NOT NULL DEFAULT 1 AFTER ativo', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'foto_path'
);
SET @sql_add := IF(@column_exists = 0, 'ALTER TABLE usuario ADD COLUMN foto_path VARCHAR(255) NULL AFTER login_habilitado', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'created_at'
);
SET @sql_add := IF(@column_exists = 0, 'ALTER TABLE usuario ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER foto_path', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'updated_at'
);
SET @sql_add := IF(@column_exists = 0, 'ALTER TABLE usuario ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND COLUMN_NAME = 'ultimo_acesso_em'
);
SET @sql_add := IF(@column_exists = 0, 'ALTER TABLE usuario ADD COLUMN ultimo_acesso_em DATETIME NULL AFTER updated_at', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuario' AND INDEX_NAME = 'uk_usuario_cpf'
);
SET @sql_add := IF(@index_exists = 0, 'ALTER TABLE usuario ADD UNIQUE KEY uk_usuario_cpf (cpf)', 'SELECT 1');
PREPARE stmt_add FROM @sql_add; EXECUTE stmt_add; DEALLOCATE PREPARE stmt_add;

CREATE TABLE IF NOT EXISTS funcionario_auditoria (
  id BIGINT NOT NULL AUTO_INCREMENT,
  actor_id INT NULL,
  target_user_id INT NULL,
  action VARCHAR(50) NOT NULL,
  details TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_funcionario_auditoria_created (created_at),
  KEY idx_funcionario_auditoria_target (target_user_id),
  KEY idx_funcionario_auditoria_actor (actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS funcionario_login_eventos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  usuario_id INT NULL,
  email_tentado VARCHAR(100) NOT NULL,
  resultado ENUM('success', 'failure') NOT NULL,
  motivo VARCHAR(50) NOT NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_funcionario_login_usuario (usuario_id, created_at),
  KEY idx_funcionario_login_created (created_at),
  KEY idx_funcionario_login_email (email_tentado, created_at),
  CONSTRAINT fk_funcionario_login_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS funcionario_perfis_permissoes (
  cargo VARCHAR(100) NOT NULL,
  dashboard TINYINT(1) NOT NULL DEFAULT 0,
  clientes TINYINT(1) NOT NULL DEFAULT 0,
  produtos TINYINT(1) NOT NULL DEFAULT 0,
  pedidos TINYINT(1) NOT NULL DEFAULT 0,
  relatorios TINYINT(1) NOT NULL DEFAULT 0,
  funcionarios TINYINT(1) NOT NULL DEFAULT 0,
  entregas TINYINT(1) NOT NULL DEFAULT 0,
  retiradas TINYINT(1) NOT NULL DEFAULT 0,
  pagamentos TINYINT(1) NOT NULL DEFAULT 0,
  estoque TINYINT(1) NOT NULL DEFAULT 0,
  fornecedor TINYINT(1) NOT NULL DEFAULT 0,
  cadastro_admin TINYINT(1) NOT NULL DEFAULT 0,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cargo),
  KEY idx_funcionario_perfis_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_permission_actions (
  usuario_id INT NOT NULL,
  module_key VARCHAR(32) NOT NULL,
  action_key ENUM('view', 'create', 'edit', 'remove') NOT NULL,
  PRIMARY KEY (usuario_id, module_key, action_key),
  CONSTRAINT fk_user_permission_actions_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS funcionario_perfil_acoes (
  cargo VARCHAR(100) NOT NULL,
  module_key VARCHAR(32) NOT NULL,
  action_key ENUM('view', 'create', 'edit', 'remove') NOT NULL,
  PRIMARY KEY (cargo, module_key, action_key),
  CONSTRAINT fk_funcionario_perfil_acoes_cargo
    FOREIGN KEY (cargo) REFERENCES funcionario_perfis_permissoes(cargo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE user_permissions
SET estoque = 1
WHERE COALESCE(produtos, 0) = 1 AND COALESCE(estoque, 0) = 0;

UPDATE user_permissions
SET retiradas = 1
WHERE COALESCE(entregas, 0) = 1 AND COALESCE(retiradas, 0) = 0;

UPDATE user_permissions
SET pagamentos = 1
WHERE (COALESCE(entregas, 0) = 1 OR COALESCE(relatorios, 0) = 1)
  AND COALESCE(pagamentos, 0) = 0;

INSERT IGNORE INTO user_permission_actions (usuario_id, module_key, action_key)
SELECT p.usuario_id, modules.module_key, actions.action_key
FROM user_permissions p
CROSS JOIN (
  SELECT 'dashboard' AS module_key UNION ALL SELECT 'clientes' UNION ALL
  SELECT 'produtos' UNION ALL SELECT 'pedidos' UNION ALL SELECT 'relatorios' UNION ALL
  SELECT 'funcionarios' UNION ALL SELECT 'entregas' UNION ALL SELECT 'retiradas' UNION ALL
  SELECT 'pagamentos' UNION ALL SELECT 'estoque' UNION ALL SELECT 'fornecedor' UNION ALL
  SELECT 'cadastro_admin'
) modules
CROSS JOIN (
  SELECT 'view' AS action_key UNION ALL SELECT 'create' UNION ALL
  SELECT 'edit' UNION ALL SELECT 'remove'
) actions
WHERE CASE modules.module_key
  WHEN 'dashboard' THEN COALESCE(p.dashboard, 0)
  WHEN 'clientes' THEN COALESCE(p.clientes, 0)
  WHEN 'produtos' THEN COALESCE(p.produtos, 0)
  WHEN 'pedidos' THEN COALESCE(p.pedidos, 0)
  WHEN 'relatorios' THEN COALESCE(p.relatorios, 0)
  WHEN 'funcionarios' THEN COALESCE(p.funcionarios, 0)
  WHEN 'entregas' THEN COALESCE(p.entregas, 0)
  WHEN 'retiradas' THEN COALESCE(p.retiradas, 0)
  WHEN 'pagamentos' THEN COALESCE(p.pagamentos, 0)
  WHEN 'estoque' THEN COALESCE(p.estoque, 0)
  WHEN 'fornecedor' THEN COALESCE(p.fornecedor, 0)
  WHEN 'cadastro_admin' THEN COALESCE(p.cadastro_admin, 0)
  ELSE 0
END = 1;
