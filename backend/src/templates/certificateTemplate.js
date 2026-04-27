module.exports = (data) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        margin: 0;
        padding: 0;
      }

      .page {
        position: relative;
        width: 1123px;
        height: 794px;
        background: url('file://${process.cwd()}/src/assets/certificate-bg.png') no-repeat center;
        background-size: cover;
        font-family: Arial, sans-serif;
        color: #ffffff;
      }

      .content {
        position: absolute;
        top: 180px;
        width: 100%;
        text-align: center;
      }

      .title {
        font-size: 42px;
        color: #d4af37;
        margin-bottom: 20px;
        letter-spacing: 2px;
      }

      .subtitle {
        font-size: 18px;
        margin-bottom: 20px;
      }

      .name {
        font-size: 36px;
        font-weight: bold;
        margin: 20px 0;
      }

      .info {
        font-size: 18px;
        margin-top: 20px;
        line-height: 1.6;
      }

      .qr {
        position: absolute;
        bottom: 120px;
        left: 120px;
      }

      .hash {
        position: absolute;
        bottom: 120px;
        right: 120px;
        font-size: 12px;
      }

      .verify {
        position: absolute;
        bottom: 60px;
        width: 100%;
        text-align: center;
        font-size: 12px;
      }

    </style>
  </head>

  <body>
    <div class="page">

      <div class="content">
        <div class="title">CERTIFICADO</div>

        <div class="subtitle">
          Certificamos que
        </div>

        <div class="name">
          ${data.nome}
        </div>

        <div class="info">
          concluiu com êxito o curso <b>${data.curso}</b><br/>
          com carga horária de ${data.cargaHoraria} horas<br/>
          Emitido em ${data.data}
        </div>
      </div>

      <img class="qr" src="${data.qrCode}" width="140"/>

      <div class="hash">
        HASH: ${data.hash}
      </div>

      <div class="verify">
        Verifique em: ${data.verificationUrl}
      </div>

    </div>
  </body>
  </html>
  `;
};