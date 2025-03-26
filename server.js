const express = require("express");
const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
app.use(express.json());

app.post("/mix", async (req, res) => {
  const { meditacion, fondo } = req.body;

  if (!meditacion || !fondo) {
    return res.status(400).json({ error: "Se requieren ambas URLs de audio" });
  }

  const id = uuidv4();
  const basePath = "/tmp"; // compatible con Railway, Render, etc.

  const meditacionPath = path.join(basePath, `${id}_meditacion.mp3`);
  const fondoPath = path.join(basePath, `${id}_fondo.mp3`);
  const outputPath = path.join(basePath, `${id}_final.mp3`);

  try {
    // Descargar audios
    const downloadFile = async (url, filePath) => {
      const response = await axios({ url, responseType: "stream" });
      const writer = fs.createWriteStream(filePath);
      return new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    };

    await downloadFile(meditacion, meditacionPath);
    await downloadFile(fondo, fondoPath);

    // Ejecutar FFmpeg
    const command = `ffmpeg -i "${meditacionPath}" -i "${fondoPath}" -filter_complex "[1:a]volume=0.2[a1];[0:a][a1]amix=inputs=2:duration=first" -y "${outputPath}"`;

    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error("FFmpeg error:", stderr);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // Enviar resultado
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", "attachment; filename=final.mp3");
    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);

    // Limpieza (opcional)
    stream.on("close", () => {
      fs.unlinkSync(meditacionPath);
      fs.unlinkSync(fondoPath);
      fs.unlinkSync(outputPath);
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Error al mezclar los audios" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎧 Servidor corriendo en el puerto ${PORT}`);
});
