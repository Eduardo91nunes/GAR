# Site G.A.R — Grupamento de Apoio Rápido

React + CSS puro (front) · Node/Express (API) · MySQL (banco, inclusive as imagens).

## Como rodar

Pré-requisitos: Node 18+ e MySQL 8+.

1. **Banco de dados**
   ```bash
   mysql -u root -p < database/schema.sql
   ```
   As fotos (veículos/QRU) ficam no próprio MySQL (tabela `imagens`, `LONGBLOB`). Se der erro de pacote grande ao enviar foto, aumente o limite:
   ```sql
   SET GLOBAL max_allowed_packet = 16777216;
   ```

2. **API**
   ```bash
   cd server
   cp .env.example .env     # ajuste usuário/senha do MySQL e o JWT_SECRET
   npm install
   npm start                # http://localhost:3001
   ```

3. **Site**
   ```bash
   cd client
   npm install
   npm run dev              # http://localhost:5173
   ```

## Primeiro acesso

- **O primeiro usuário criado vira administrador automaticamente.** Crie o seu primeiro.
- Os demais oficiais criam o próprio usuário na tela de login ("criar conta").
- Em **Usuários** (admin) você promove/remove administradores.
- Em **Cursos e questões** (admin) você cola o resumo de cada curso (BSA e Negociação) e cadastra as questões (uma a uma ou importando JSON).

## Regras implementadas

- **Provas:** cada prova sorteia 15 questões do banco do curso; nota de 0 a 10; corte 7 (precisa de 11 acertos em 15). Mínimo de 15 questões cadastradas por curso.
- **Ranking:** 3 pts por hora completa de bate-ponto · 3 pts por ocorrência (para cada oficial) · 3 pts por veículo preso em ação (para cada oficial) · 10 pts por vitória (para cada oficial).
- **Admin:** ao logar, abre o Dashboard (cursos, ocorrências, ações, horas, top 5).

## Logo

O brasão está em `client/public/logo-gar.png`. Para trocar, substitua o arquivo.


## Integração com Discord — Unidade GAR

A API envia notificações para os canais configurados quando uma ocorrência ou ação é cadastrada e quando uma prova é finalizada. As notificações usam embeds e a ocorrência inclui a imagem anexada quando disponível. O salvamento no MySQL não é desfeito se o Discord estiver indisponível.

### Configuração segura

1. Crie a aplicação/bot em https://discord.com/developers/applications e adicione-o ao servidor GAR.
2. Conceda somente `View Channels`, `Send Messages`, `Embed Links` e `Attach Files` nos canais necessários. Não conceda `Administrator`.
3. Copie `server/.env.example` para `server/.env` e preencha `DISCORD_BOT_TOKEN` com o token real. O token nunca deve ir para o frontend, Git ou mensagens públicas.
4. Os IDs dos canais já estão preenchidos no exemplo. Se forem alterados, atualize as três variáveis `DISCORD_CHANNEL_*`.
5. Reinicie a API depois de alterar o `.env`.

O código utiliza `fetch`/`FormData` nativos do Node.js 18 ou superior e não precisa de uma biblioteca adicional de Discord. Se o token não estiver configurado ou a API do Discord retornar erro, a falha é registrada no console do backend e os dados já salvos no MySQL permanecem intactos.
