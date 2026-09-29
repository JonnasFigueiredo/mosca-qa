@echo off
cd /d "%~dp0"
echo Abra http://127.0.0.1:8770 no navegador.
echo Mantenha esta janela aberta enquanto as campanhas estiverem rodando.
node scripts/experimentos.mjs
pause
