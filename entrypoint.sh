#!/bin/bash -l

echo "Adding GitHub to known hosts..."
mkdir -p ~/.ssh
ssh-agent -a "$INPUT_SSH_AUTH_SOCK" > /dev/null
ssh-keyscan github.com >> ~/.ssh/known_hosts
ssh-add - <<< "$INPUT_SSH_PRIVATE_KEY"
echo "Transferring files to $INPUT_HOST..."
read -ar files_to_transport <<< "$INPUT_FILES"
for filepath in "${files_to_transport[@]}"; do
    echo "Preparing $filepath for sync..."
    parent_dir=$(dirname "$filepath")
    mkdir -p "dist/${parent_dir}"
    cp -r "$filepath" "dist/${filepath}"
done
rsync -rPv -e "ssh -p $INPUT_SSH_PORT -o 'StrictHostKeyChecking no'" dist/ "${INPUT_USER}@${INPUT_HOST}:${INPUT_TARGET}"
echo "Starting SSH session with $INPUT_HOST..."
ssh -o StrictHostKeyChecking=no -p "$INPUT_SSH_PORT" "${INPUT_USER}@${INPUT_HOST}" "cd $INPUT_TARGET && $INPUT_DEPLOY_COMMAND"
