const express = require("express") 
const mysql = require("mysql2/promise")
const app = express();

const pool = mysql.createPool({
    host: "localhost",
    user:"root",
    password:"root", 
    database:"musica_db"
})

async function initDB(){
    try{
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS musica (
              id INT AUTO_INCREMENT PRIMARY KEY,
              titulo VARCHAR(200) NOT NULL,
              artista VARCHAR(200) NOT NULL,
              genero VARCHAR(50) NOT NULL,
              ano INT NOT NULL,
              favorita BOOLEAN DEFAULT FALSE
            )
          `);
          console.log("Tabela 'musica' pronta.");


        } catch (erro) {
            console.error("Erro ao ligar ao MySQL:", erro.message);
            console.error("Verifica se o MySQL esta a correr e se 'musicas_db' existe.");
            process.exit(1);
          }
}



app.use(express.json())  //MIDDLEWARE
const path = require("path");
  app.use(express.static(path.join(__dirname, "frontend")));


const musicas = []
const generosValidos = ["pop", "rock", "hip-hop", "eletronico", "jazz", "classico", "outro"];
let proximoId = 0

app.use((req, res, next) => {
    const hora = new Date().toLocaleTimeString("pt-PT");
    console.log(`[${hora}] ${req.method} ${req.url}`);
    next(); 
  });


function validarMusica (req,res,next){
    const {titulo, artista, genero, ano } = req.body
    const erros = []
    //titulo
    if(!titulo || titulo.trim().length < 2 || !String(titulo)){
        erros.push("Título obrigatório (min. 2 car)")
    }

    //artista
    if (!artista || artista.trim().length === 0 || !String(artista)){
        erros.push("Artista obrigatório")

    }
    //genero
    const generoNormalizado = String(genero).trim().toLowerCase();
    if (!generoNormalizado || !generosValidos.includes(generoNormalizado)){
        erros.push("genero obrigatório")
    }

    if (erros.length > 0 ){
        res.status(400).json({ erros })

    }

    next() // PROXIMO MIDDLEWARE OU ROTA

}


// GET /API/MUSICAS
app.get("/api/musicas", async (req,res) =>{
 
     try {
        let query = "SELECT * FROM musica"
        const condicoes = []
        const valores = []
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
        valores.push(req.query.favorita === "true");
      }
      
    if (condicoes.length > 0) {
        sql += " WHERE " + condicoes.join(" AND ");
      }

        const [musicas] = await pool.execute(sql, valores)
        res.status(200).json(musicas)
     } catch (erro) {
        console.error("Erro no GET", erro.message)
        res.status(500).json({erro:"Erro a procurar músicas"})
     }



})

// GET api/musicas/:id - obter id
app.get("/api/musicas/:id", (req, res) => {
    const id = Number(req.params.id);
    const musica = musicas.find((m) => m.id === id);
  
    if (!musica) {
      return res.status(404).json({ erro: "Musica nao encontrada" });
    }
  
    res.json(musica);
  });



  // POST /api/musicas - Adicionar (com middleware de validacao)
// Modelo de dados

/*Musica {
  id: number
  titulo: string (obrigatorio, min 2 caracteres)
  artista: string (obrigatorio)
  genero: string (obrigatorio: "pop", "rock", "hip-hop", "eletronico", "jazz", "classico", "outro")
  ano: number (obrigatorio, entre 1900 e ano atual)
  favorita: boolean (default: false)
  adicionadaEm: string (data ISO automatica)
} */

app.post("/a