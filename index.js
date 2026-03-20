const express = require("express");
const mysql = require("mysql2/promise");
const app = express();
app.use(express.json());
const PORT = 3000;
const path = require("path");
app.use(express.static(path.join(__dirname, "frontend")));
const generosValidos = [
  "pop",
  "rock",
  "hip-hop",
  "eletronico",
  "jazz",
  "classico",
  "outro",
];
//Preparar SQL

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: "musica_db",
});

//Criar ligação
async function initDB() {
  try {
    await pool.execute(
      `CREATE TABLE IF NOT EXISTS musica (
                id INT AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(200) NOT NULL,
                artista VARCHAR(200) NOT NULL,
                genero VARCHAR(50) NOT NULL,
                ano INT NOT NULL,
                favorita BOOLEAN DEFAULT FALSE
            )`,
    );
    console.log("Tabela musicas criada!");
  } catch (erro) {
    console.error("Erro ao ligar ao MySQL:", erro.message);
    console.error("Verifica se o MySQL esta a correr e se 'musica_db' existe.");
    process.exit(1);
  }
}

app.get("/", (req, res) => {
  res.status(200).json("Biblioteca de música");
});

app.use((req, res, next) => {
  const hora = new Date().toLocaleTimeString("pt-PT");
  console.log(`[${hora}] ${req.method} ${req.url}`);
  next();
});

function validarMusica(req, res, next) {
  const { titulo, artista, genero, ano } = req.body;
  const erros = [];
  //titulo
  if (!titulo || titulo.trim().length < 2 || !String(titulo)) {
    erros.push("Título obrigatório (min. 2 car)");
  }

  //artista
  if (!artista || artista.trim().length === 0 || !String(artista)) {
    erros.push("Artista obrigatório");
  }
  //genero
  const generoNormalizado = String(genero).trim().toLowerCase();
  if (!generoNormalizado || !generosValidos.includes(generoNormalizado)) {
    erros.push("genero obrigatório");
  }

  if (erros.length > 0) {
    res.status(400).json({ erros });
  }

  next(); // PROXIMO MIDDLEWARE OU ROTA
}

//GET
app.get("/api/musicas", async (req, res) => {
  try {
    let query = "SELECT * FROM musica";
    const condicoes = [];
    const valores = [];
    // Filtro por genero: /api/musicas?genero=rock
    if (req.query.genero) {
      condicoes.push("genero = ?");
      valores.push(req.query.genero);
    }
    // Filtro por artista: /api/musicas?artista=queen (pesquisa parcial)
    if (req.query.artista) {
      condicoes.push("artista LIKE ?");
      valores.push("%" + req.query.artista + "%"); // % = qualquer texto antes/depois
    }
    // Filtro por favorita: /api/musicas?favorita=true
    if (req.query.favorita === "true" || req.query.favorita === "false") {
      condicoes.push("favorita = ?");
      valores.push(req.query.favorita);
    }

    if (condicoes.length > 0) {
      query += " WHERE " + condicoes.join(" AND ");
    }

    const [musicas] = await pool.execute(query, valores);
    res.status(200).json(musicas);
  } catch (erro) {
    console.error("Erro no GET", erro.message);
    res.status(500).json({ erro: "Erro a procurar músicas" });
  }
});

//GET ID
app.get("/api/musicas/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const query = "SELECT * FROM musica WHERE id=?";
    const [musica] = await pool.execute(query, [id]);
    if (musica.length === 0) {
      return res.status(404).json({ erro: "Musica não encontrada" });
    }
    console.log(musica);
    res.status(200).json(musica[0]);
  } catch (erro) {
    console.error("Erro no GET", erro.message);
    res.status(500).json({ erro: "Erro a procurar musicas" });
  }
});
//POST
app.post("/api/musicas", validarMusica, async (req, res) => {
  try {
    const { titulo, artista, genero, ano } = req.body;

    if (!titulo || !artista || !genero || !ano) {
      return res
        .status(400)
        .json({ erro: "Todos os campos sao obrigatorios!" });
    }
    const query =
      "INSERT INTO musica (titulo, artista, genero, ano) VALUES (?, ?, ?, ?)";
    const [resultado] = await pool.execute(query, [
      titulo,
      artista,
      genero,
      ano,
    ]);

    res.status(200).send("Musica criada com sucesso!");
  } catch (erro) {
    console.error("Erro no POST:", erro.message);
    res.status(500).json({ erro: "Erro ao criar musica!" });
  }
});
//PUT
app.put("/api/musicas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [musica] = await pool.execute("SELECT * FROM musica WHERE id=?", [
      id,
    ]);
    if (musica.length === 0) {
      return res.status(404).json({ erro: "Musica nao existe" });
    }
    const musicaAtual = musica[0];
    const { titulo, artista, genero, ano } = req.body;
    const params = [
      titulo ?? musicaAtual.titulo,
      artista ?? musicaAtual.artista,
      genero ?? musicaAtual.genero,
      ano ?? musicaAtual.ano,
      id,
    ];
    const query =
      "UPDATE musica SET titulo=?, artista=?, genero=?, ano=? WHERE id=?";
    const [result] = await pool.execute(query, params);
    res.status(200).json(result);
  } catch (erro) {
    res.status(500).json({ erro: "Bateu no poste" });
  }
});
//PATCH
app.patch("/api/musicas/:id/favorita", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [musica] = await pool.execute("SELECT * FROM musica WHERE id = ?", [
      id,
    ]);
    if (musica.length === 0) {
      return res.status(404).json({ erro: "Música não existe" });
    }
    await pool.execute(
      "UPDATE musica SET favorita = NOT favorita WHERE id = ?",
      [id],
    );

    res.status(200).send("Música adicionada aos favoritos");
  } catch (error) {
    console.error("Erro no PATCH:", erro.message);
    res.status(500).json({ erro: "Erro ao alternar favorita" });
  }
});
//DELETE
app.delete("/api/musicas/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const query = "DELETE FROM musica WHERE id=?";
    const [musica] = await pool.execute(query, [id]);
    if (musica.length === 0) {
      return res.status(404).json({ erro: "Musica não encontrada" });
    }
    res.status(200).json("Musica Removida!");
  } catch (erro) {
    console.error("Erro no DELETE", erro.message);
    res.status(500).json({ erro: "Erro a procurar musicas" });
  }
});
//--------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ erro: "404 - Not Found" });
});

app.use((err, req, res, next) => {
  res.status(500).json({ erro: "500 - Erro Servidor" });
});

initDB();

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
