# deploy-docker-ssh

<p align="center">
  <a href=""><img alt="deploy-docker-ssh status" src="https://github.com/iacobfred/deploy-docker-ssh/workflows/units-test/badge.svg"></a>
</p>

This [action](https://docs.github.com/en/actions) pulls Docker images (and any necessary files) to a remote server via an SSH connection and starts up the associated container(s) after optionally running additional commands on the server.

It is intended to be used after Docker images are built and pushed to a container registry—e.g., through use of Docker's [build-push-action](https://github.com/docker/build-push-action).

## Inputs

## `host`

The host name or IP address of the server to which this action will connect via SSH to deploy the container(s).

## `user`

The username to use when connecting to the server via SSH.

## `target`

The absolute filepath of the directory to which necessary files (e.g., docker-compose.yml) will be transferred/synced on the server. This is also the working directory in which the command(s) specified in the `command` input will be executed.

## `files`

A space-delimited list of relative paths (e.g., `.env docker-compose.yml`) to be synced to the server's target directory.

Note: These relative paths are copied recursively into a temporary directory (via `cp -r`) which is then synced to the server's target directory via the `rsync` utility. The full relative paths are preserved; e.g., `a/b/c.txt` is synced to `[target]/a/b/c.txt`. This means that you can safely use these paths as Docker volumes without modifying the volume paths specified in the `docker-compose.yml` file used in development.

## `ssh-port`

The SSH port (e.g., 22) to use for connecting to the server.

## `ssh-private-key`

The private key generated on the server, used to authenticate the SSH connection.

## `ssh-auth-sock`

The SSH_AUTH_SOCK environment variable, used to authenticate the SSH connection.

**Default**: `'/tmp/ssh_agent.sock'`

## `command`

The command to run on the server (through an SSH connection) to deploy the new container(s).

**Default**: `set -a; source .env; set +a; docker compose pull && docker compose up -d`

## Example usage

```yaml

---
uses: iacobfred/deploy-docker-ssh@v1
with:
  host: "server.com"
  user: "jacob"
  target: /var/www/server.com'
  files: |
    .env
    docker-compose.yml
    .config/nginx.conf
  ssh-port: "22"
  ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
  command: |
    set -a && source .env && set +a &&
    echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.repository_owner }} --password-stdin &&
    docker compose pull && docker compose up -d &&
    if [ $RELOAD_WEBSERVER = true ]; then echo 'Reloading webserver...'; nginx -s reload; fi;
    docker system prune -f
```
