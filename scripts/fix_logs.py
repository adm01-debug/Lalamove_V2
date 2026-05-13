import os
import re

def process_file(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Se não tem console.log nem logger.log, ignora
    if 'console.log' not in content and 'logger.log' not in content:
        return

    # Substitui console.log por logger.log
    new_content = content.replace('console.log', 'logger.log')
    new_content = new_content.replace('console.debug', 'logger.debug')
    new_content = new_content.replace('console.info', 'logger.info')
    
    # Adiciona import se logger.log for usado e o import não existir
    if 'logger.' in new_content and 'from \'@/utils/logger\'' not in new_content and 'from "@/utils/logger"' not in new_content:
        # Tenta inserir após o último import
        import_stmt = "import { logger } from '@/utils/logger';\n"
        last_import = -1
        lines = new_content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import = i
        
        if last_import != -1:
            lines.insert(last_import + 1, import_stmt)
            new_content = '\n'.join(lines)
        else:
            new_content = import_stmt + new_content

    if new_content != content:
        with open(file_path, 'w') as f:
            f.write(new_content)
        print(f"Processed: {file_path}")

def main():
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
