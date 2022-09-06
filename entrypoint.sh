#!/bin/bash

[ -z "$INPUT_SSH_AUTH_SOCK" ] && echo "SSH_AUTH_SOCK is not set." && exit 1
[ -z "$INPUT_HOST" ] && echo "HOST is not set." && exit 1
[ -z "$INPUT_USER" ] && echo "USER is not set." && exit 1
[ -z "$INPUT_TARGET" ] && echo "TARGET is not set." && exit 1
[ -z "$INPUT_SSH_PORT" ] && echo "SSH_PORT is not set." && exit 1
[ -z "$INPUT_SSH_PRIVATE_KEY" ] && echo "SSH_PRIVATE_KEY is not set." && exit 1
[ -z "$INPUT_COMMAND" ] && echo "COMMAND is not set." && exit 1

echo "Adding GitHub to known hosts..."
mkdir -p ~/.ssh
ssh-agent -a "$INPUT_SSH_AUTH_SOCK" > /dev/null
ssh-keyscan github.com >> ~/.ssh/known_hosts
ssh-add - <<< "$INPUT_SSH_PRIVATE_KEY"
[ -z "$INPUT_FILES" ] || {
    echo "Transferring files to $INPUT_HOST..."
    read -ar files_to_transport <<< "$INPUT_FILES"
    for filepath in "${files_to_transport[@]}"; do
        echo "Preparing $filepath for sync..."
        parent_dir=$(dirname "$filepath")
        mkdir -p "dist/${parent_dir}"
        cp -r "$filepath" "dist/${filepath}"
    done
    rsync -rPv -e "ssh -p $INPUT_SSH_PORT -o 'StrictHostKeyChecking no'" dist/ "${INPUT_USER}@${INPUT_HOST}:${INPUT_TARGET}"
} 
echo "Starting SSH session with $INPUT_HOST..."
command="cd ${INPUT_TARGET} && ${INPUT_COMMAND}"
ssh -o StrictHostKeyChecking=no -p "$INPUT_SSH_PORT" "${INPUT_USER}@${INPUT_HOST}" "$command"
