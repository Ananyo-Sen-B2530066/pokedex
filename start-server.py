#!/usr/bin/env python3
"""Start the Rotom-Dex server fully detached from the calling shell/process group
so it survives terminal/shell-tool timeouts. Usage: python3 start-server.py"""
import os, sys

LOG = '/tmp/pokeN.log'
APP_DIR = os.path.dirname(os.path.abspath(__file__))

pid = os.fork()
if pid > 0:
    os._exit(0)

os.setsid()
os.chdir(APP_DIR)
fd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
os.dup2(fd, 1)
os.dup2(fd, 2)
devnull = os.open('/dev/null', os.O_RDONLY)
os.dup2(devnull, 0)
os.execvp('node', ['node', 'dist/src/index.js'])