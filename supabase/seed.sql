-- ============================================================
-- Seed data: Categories and Subcategories
-- ============================================================

-- Main categories
INSERT INTO categories (id, name, icon, display_order) VALUES
  ('reparos_domesticos', 'Reparos Domésticos', '🔧', 1),
  ('servicos_pessoais', 'Serviços Pessoais', '✂️', 2),
  ('automotivo', 'Automotivo', '🚗', 3),
  ('construcao', 'Construção', '🏗️', 4),
  ('outros', 'Outros', '📦', 5);

-- Subcategories: Reparos Domésticos
INSERT INTO subcategories (id, category_id, name, keywords, display_order) VALUES
  ('eletricista', 'reparos_domesticos', 'Eletricista',
    ARRAY['eletricista', 'elétrica', 'fiação', 'tomada', 'disjuntor', 'curto circuito', 'instalação elétrica', 'luz', 'lâmpada', 'chuveiro elétrico', 'quadro de força'],
    1),
  ('encanador', 'reparos_domesticos', 'Encanador',
    ARRAY['encanador', 'hidráulica', 'vazamento', 'cano', 'torneira', 'descarga', 'esgoto', 'caixa d''água', 'tubulação', 'entupimento', 'registro'],
    2),
  ('pintor', 'reparos_domesticos', 'Pintor',
    ARRAY['pintor', 'pintura', 'parede', 'tinta', 'textura', 'massa corrida', 'verniz', 'impermeabilização', 'grafiato'],
    3),
  ('marceneiro', 'reparos_domesticos', 'Marceneiro',
    ARRAY['marceneiro', 'marcenaria', 'móvel', 'armário', 'porta', 'madeira', 'móvel planejado', 'estante', 'prateleira', 'reparo em móvel'],
    4),
  ('serralheiro', 'reparos_domesticos', 'Serralheiro',
    ARRAY['serralheiro', 'grade', 'portão', 'ferro', 'solda', 'metalúrgica', 'esquadria', 'corrimão'],
    5),
  ('vidraceiro', 'reparos_domesticos', 'Vidraceiro',
    ARRAY['vidraceiro', 'vidro', 'box', 'espelho', 'janela', 'blindex', 'vidro temperado'],
    6),
  ('chaveiro', 'reparos_domesticos', 'Chaveiro',
    ARRAY['chaveiro', 'chave', 'fechadura', 'cadeado', 'tranca', 'cópia de chave', 'porta trancada'],
    7);

-- Subcategories: Serviços Pessoais
INSERT INTO subcategories (id, category_id, name, keywords, display_order) VALUES
  ('costureira', 'servicos_pessoais', 'Costureira',
    ARRAY['costureira', 'costura', 'roupa', 'ajuste', 'bainha', 'conserto de roupa', 'alfaiate', 'bordado', 'customização'],
    1),
  ('cabeleireiro', 'servicos_pessoais', 'Cabeleireiro',
    ARRAY['cabeleireiro', 'cabelo', 'corte', 'escova', 'tintura', 'salão', 'barbeiro', 'penteado', 'tratamento capilar'],
    2),
  ('manicure', 'servicos_pessoais', 'Manicure',
    ARRAY['manicure', 'pedicure', 'unha', 'esmalte', 'cutícula', 'unha gel', 'nail designer'],
    3),
  ('diarista', 'servicos_pessoais', 'Diarista',
    ARRAY['diarista', 'faxina', 'limpeza', 'doméstica', 'passadeira', 'lavar', 'passar roupa'],
    4),
  ('cuidador', 'servicos_pessoais', 'Cuidador',
    ARRAY['cuidador', 'idoso', 'babá', 'acompanhante', 'enfermeiro', 'cuidador de idoso', 'cuidador de criança'],
    5),
  ('personal_trainer', 'servicos_pessoais', 'Personal Trainer',
    ARRAY['personal trainer', 'academia', 'exercício', 'treino', 'musculação', 'condicionamento físico'],
    6);

-- Subcategories: Automotivo
INSERT INTO subcategories (id, category_id, name, keywords, display_order) VALUES
  ('mecanico', 'automotivo', 'Mecânico',
    ARRAY['mecânico', 'mecânica', 'carro', 'motor', 'freio', 'suspensão', 'troca de óleo', 'revisão', 'oficina', 'conserto de carro'],
    1),
  ('eletricista_automotivo', 'automotivo', 'Eletricista Automotivo',
    ARRAY['eletricista automotivo', 'elétrica automotiva', 'bateria', 'alternador', 'motor de arranque', 'injeção eletrônica'],
    2),
  ('funileiro', 'automotivo', 'Funileiro e Pintor',
    ARRAY['funileiro', 'funilaria', 'pintura automotiva', 'lataria', 'amassado', 'polimento', 'retoque'],
    3),
  ('borracheiro', 'automotivo', 'Borracheiro',
    ARRAY['borracheiro', 'pneu', 'borracharia', 'calibragem', 'troca de pneu', 'remendo', 'alinhamento', 'balanceamento'],
    4),
  ('lavador', 'automotivo', 'Lavador de Carros',
    ARRAY['lava jato', 'lavagem', 'lavar carro', 'polimento', 'higienização', 'detalhamento automotivo'],
    5);

-- Subcategories: Construção
INSERT INTO subcategories (id, category_id, name, keywords, display_order) VALUES
  ('pedreiro', 'construcao', 'Pedreiro',
    ARRAY['pedreiro', 'obra', 'construção', 'alvenaria', 'reboco', 'contrapiso', 'muro', 'laje', 'reforma'],
    1),
  ('azulejista', 'construcao', 'Azulejista',
    ARRAY['azulejista', 'azulejo', 'piso', 'revestimento', 'cerâmica', 'porcelanato', 'rejunte', 'assentamento'],
    2),
  ('gesseiro', 'construcao', 'Gesseiro',
    ARRAY['gesseiro', 'gesso', 'drywall', 'forro', 'sanca', 'moldura', 'divisória'],
    3),
  ('telhadista', 'construcao', 'Telhadista',
    ARRAY['telhadista', 'telhado', 'telha', 'calha', 'goteira', 'impermeabilização', 'cobertura', 'rufos'],
    4),
  ('arquiteto', 'construcao', 'Arquiteto',
    ARRAY['arquiteto', 'projeto', 'planta', 'design de interiores', 'decoração', 'paisagismo', 'reforma'],
    5),
  ('engenheiro', 'construcao', 'Engenheiro Civil',
    ARRAY['engenheiro', 'engenharia', 'laudo', 'ART', 'projeto estrutural', 'cálculo estrutural', 'vistoria'],
    6);

-- Subcategories: Outros
INSERT INTO subcategories (id, category_id, name, keywords, display_order) VALUES
  ('tecnico_informatica', 'outros', 'Técnico de Informática',
    ARRAY['técnico', 'informática', 'computador', 'notebook', 'formatação', 'vírus', 'reparo de PC', 'rede', 'wifi'],
    1),
  ('tecnico_celular', 'outros', 'Técnico de Celular',
    ARRAY['técnico de celular', 'celular', 'smartphone', 'tela quebrada', 'conserto de celular', 'bateria de celular'],
    2),
  ('tecnico_ar', 'outros', 'Técnico de Ar Condicionado',
    ARRAY['ar condicionado', 'instalação de ar', 'manutenção de ar', 'limpeza de ar', 'split', 'refrigeração'],
    3),
  ('jardineiro', 'outros', 'Jardineiro',
    ARRAY['jardineiro', 'jardim', 'poda', 'grama', 'paisagismo', 'plantas', 'irrigação', 'corte de grama'],
    4),
  ('dedetizador', 'outros', 'Dedetizador',
    ARRAY['dedetizador', 'dedetização', 'pragas', 'cupim', 'barata', 'rato', 'formiga', 'controle de pragas'],
    5),
  ('mudanca', 'outros', 'Mudança e Frete',
    ARRAY['mudança', 'frete', 'carreto', 'transporte', 'caminhão', 'montagem de móvel', 'desmontagem'],
    6);

-- ============================================================
-- Seed data: Initial Service Providers (Fortaleza/CE)
-- ============================================================

INSERT INTO services (
  name, description, category, subcategory, phone,
  has_whatsapp, whatsapp_confirmed, address,
  latitude, longitude, data_source, is_active
) VALUES
  (
    'Tiago F.A Ar Condicionado',
    'Instalação, manutenção e limpeza de ar condicionado split e de janela. Atendimento residencial e comercial em Fortaleza e região metropolitana.',
    'outros', 'tecnico_ar',
    '(85) 98142-5401',
    true, true,
    'Fortaleza, CE',
    -3.7172, -38.5433,
    'manual', true
  ),
  (
    'Felipe Eletricista',
    'Serviços de instalação e manutenção elétrica residencial e predial. Troca de fiação, disjuntores, tomadas, chuveiros e quadros de força.',
    'reparos_domesticos', 'eletricista',
    '(85) 81729-135',
    true, true,
    'Fortaleza, CE',
    -3.7327, -38.5267,
    'manual', true
  ),
  (
    'Edmário Chaveiro',
    'Abertura de portas, troca de fechaduras, cópias de chaves, instalação de trancas e cadeados. Atendimento 24h em Fortaleza.',
    'reparos_domesticos', 'chaveiro',
    '(85) 96182-047',
    true, true,
    'Fortaleza, CE',
    -3.7400, -38.5100,
    'manual', true
  ),
  (
    'Antonio Oliveira - Bombeiro Hidráulico',
    'Reparos hidráulicos, desentupimentos, conserto de vazamentos, instalação de torneiras, caixas d''água e tubulações em geral.',
    'reparos_domesticos', 'encanador',
    '(85) 9138-4289',
    true, true,
    'Fortaleza, CE',
    -3.7500, -38.5300,
    'manual', true
  ),
  (
    'Drogaria Ceará',
    'Farmácia e drogaria com entrega em domicílio. Medicamentos, produtos de higiene e perfumaria.',
    'outros', NULL,
    '(85) 99999-9999',
    true, true,
    'Fortaleza, CE',
    -3.7250, -38.5400,
    'manual', true
  ),
  (
    'Francisco Jardineiro',
    'Serviços de jardinagem, poda de árvores, corte de grama, limpeza de terreno, plantio e manutenção de jardins residenciais e comerciais.',
    'outros', 'jardineiro',
    '(85) 99402-1416',
    true, true,
    'Fortaleza, CE',
    -3.7350, -38.5500,
    'manual', true
  ),
  (
    'Sonia Mota Costureira',
    'Costura, ajustes de roupas, bainhas, consertos, customização e pequenos reparos em vestuário. Atendimento com qualidade e pontualidade.',
    'servicos_pessoais', 'costureira',
    '(85) 98100-4868',
    true, true,
    'Fortaleza, CE',
    -3.7280, -38.5350,
    'manual', true
  ),
  (
    'Lacarte Marmitaria',
    'Marmitas e refeições variadas para almoço e jantar, com opções do dia. Entregas na região de Fortaleza.',
    'outros', NULL,
    '(85) 99216-5444',
    true, true,
    'Fortaleza, CE',
    -3.7200, -38.5450,
    'manual', true
  );
