# OpenGym EvoluPersonal

Repositório de distribuição do fork limpo do OpenGym com os módulos EvoluPersonal. O código-fonte base está em `Fork-OpenGym.bundle`; o patch cumulativo contém as alterações da integração e da fase 3.

## Preparar o código

Baixe `Fork-OpenGym.bundle` e `Fork-OpenGym-Fase2-3.patch) desta página e deixe os dois arquivos na mesma pasta. No terminal:

```sh
git clone Fork-OpenGym.bundle OpenGym-EvoluPersonal
git -C OpenGym-EvoluPersonal apply ../Fork-OpenGym-Fase2-3.patch
cd OpenGym-EvoluPersonal/frontend
npm install
npm run dev
```

O patch cumulativo foi validado contra a revisão base contida no bundle. Para gerar a versão de produção, execute `npm run build` dentro de `frontend`.
