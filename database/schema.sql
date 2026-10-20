-- Banco de dados do site G.A.R (MySQL 8+)
CREATE DATABASE IF NOT EXISTS gar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gar;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  usuario VARCHAR(50) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  role ENUM('oficial','admin') NOT NULL DEFAULT 'oficial',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Imagens (fotos da QRU / veículos) ficam armazenadas dentro do MySQL
CREATE TABLE IF NOT EXISTS imagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mime VARCHAR(50) NOT NULL,
  dados LONGBLOB NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cursos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  resumo MEDIUMTEXT NULL
);

CREATE TABLE IF NOT EXISTS questoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  curso_id INT NOT NULL,
  enunciado TEXT NOT NULL,
  opcao_a VARCHAR(500) NOT NULL,
  opcao_b VARCHAR(500) NOT NULL,
  opcao_c VARCHAR(500) NOT NULL,
  opcao_d VARCHAR(500) NOT NULL,
  correta CHAR(1) NOT NULL,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS provas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  curso_id INT NOT NULL,
  status ENUM('andamento','finalizada') NOT NULL DEFAULT 'andamento',
  nota DECIMAL(4,2) NULL,
  aprovado TINYINT(1) NULL,
  iniciada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalizada_em DATETIME NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prova_questoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prova_id INT NOT NULL,
  questao_id INT NOT NULL,
  resposta CHAR(1) NULL,
  FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE,
  FOREIGN KEY (questao_id) REFERENCES questoes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ocorrencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  modelo_veiculo VARCHAR(100) NOT NULL,
  imagem_id INT NULL,
  descricao TEXT NULL,
  criado_por INT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (imagem_id) REFERENCES imagens(id) ON DELETE SET NULL,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS ocorrencia_oficiais (
  ocorrencia_id INT NOT NULL,
  usuario_id INT NOT NULL,
  PRIMARY KEY (ocorrencia_id, usuario_id),
  FOREIGN KEY (ocorrencia_id) REFERENCES ocorrencias(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS acoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  descricao TEXT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  resultado ENUM('vitoria','derrota') NOT NULL,
  criado_por INT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS acao_oficiais (
  acao_id INT NOT NULL,
  usuario_id INT NOT NULL,
  PRIMARY KEY (acao_id, usuario_id),
  FOREIGN KEY (acao_id) REFERENCES acoes(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS acao_veiculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  acao_id INT NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  situacao ENUM('fuga','preso') NOT NULL,
  FOREIGN KEY (acao_id) REFERENCES acoes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ponto (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  entrada DATETIME NOT NULL,
  saida DATETIME NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

INSERT INTO cursos (nome, resumo)
SELECT * FROM (SELECT 'BSA' AS nome, NULL AS resumo UNION ALL SELECT 'Negociação', NULL) t
WHERE NOT EXISTS (SELECT 1 FROM cursos);
