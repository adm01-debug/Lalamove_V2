import os
import re

def process_file(file_path):
    # Ignora o próprio logger
    if 'logger.ts' in file_path:
        return

    with open(file_path, 'r') as f:
        content = f.read()

    # Busca qualquer console.log/warn/error/debug/info
    console_pattern = r'console\.(log|warn|error|debug|info)'
    if not re.search(console_pattern, content):
        return

    # Substitui console. por logger.
    new_content = re.sub(console_pattern, r'logger.\1', content)
    
    # Verifica se o import já existe
    import_pattern = r'from [\'"]@/utils/logger[\'"]'
    if not re.search(import_pattern, new_content):
        # Tenta inserir após o último import existente
        lines = new_content.split('\n')
        last_import_idx = -1
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import_idx = i
        
        import_stmt = "import { logger } from '@/utils/logger';"
        
        if last_import_idx != -1:
            # Insere após o último import
            lines.insert(last_import_idx + 1, import_stmt)
            new_content = '\n'.join(lines)
        else:
            # Insere no topo
            new_content = import_stmt + '\n' + new_content

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
