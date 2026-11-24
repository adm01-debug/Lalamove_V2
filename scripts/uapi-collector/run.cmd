@echo off
REM Wrapper do coletor UAPI para o Task Scheduler do Windows.
REM IMPORTANTE: copie este arquivo para um caminho SEM ESPACOS (ex.:
REM C:\ProgramData\lalamove-uapi-collector\run.cmd) antes de registrar a tarefa.
REM O schtasks quebra /tr em <Command>/<Arguments> no primeiro espaco do caminho
REM (path com espaco => ultimo resultado -2147024894 / arquivo nao encontrado).
REM Instalacao:
REM   schtasks /create /tn LalamoveUapiCollector /tr "C:\ProgramData\lalamove-uapi-collector\run.cmd" /sc minute /mo 30 /ru "%USERDOMAIN%\%USERNAME%" /it /f
"C:\Windows\System32\wsl.exe" -d Ubuntu-24.04 -u joaquim_ataides -- bash -lc "bash /home/joaquim_ataides/.local/share/lalamove-uapi-collector/run.sh >> /home/joaquim_ataides/.local/share/lalamove-uapi-collector/collector.log 2>&1"