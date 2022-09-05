# deploy-image-docker-action
This Docker container action deploys a Docker image (and any necessary files) to a server as part of a GitHub Actions workflow.

## Inputs

## `host`

**Required** The host name or IP address of the server to which this action will connect via SSH to deploy the image.

## `user`

**Required** The username to use when connecting to the server via SSH.

## `target`

**Required** The absolute filepath of the directory to which necessary files (e.g., docker-compose.yml) will be transferred/synced on the server.

## `ssh-port`

**Required** The SSH port (e.g., 22) to use for connecting to the server.

## `ssh-private-key`

**Required** The private key generated on the server, used to authenticate the SSH connection.

<!-- ## Outputs

## `time`

The time we greeted you. -->

## Example usage

uses: actions/hello-world-docker-action@v1
with:
  host: 'server.com'
  user: 'jacob'
  target: '/var/www/server.com'
  ssh-port: '22'
  ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
