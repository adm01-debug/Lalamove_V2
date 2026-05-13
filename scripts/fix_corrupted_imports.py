import os
import re

def fix_file(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    # Identifica o import do logger
    target = "import { logger } from '@/utils/logger';\n"
    
    if target not in lines:
        return

    # Remove o import de onde ele estiver
    new_lines = [l for l in lines if l != target]
    
    # Encontra o ponto de inserção: após o primeiro bloco de comentários ou no topo
    insert_idx = 0
    for i, line in enumerate(new_lines):
        if line.strip() and not line.strip().startswith('//') and not line.strip().startswith('/*'):
            insert_idx = i
            break
    
    # Insere no topo real (evitando quebrar blocos de import)
    # Na verdade, o mais seguro é colocar na linha 0 se não for comentário
    new_lines.insert(insert_idx, target)

    with open(file_path, 'w') as f:
        f.writelines(new_lines)
    print(f"Fixed: {file_path}")

def main():
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                fix_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
