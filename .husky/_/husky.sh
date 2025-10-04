#!/bin/sh
# shellcheck shell=sh
# mimic husky generated script for reproducibility

if [ -z "$husky_skip_init" ]; then
  husky_skip_init=1
  if [ -f ~/.huskyrc ]; then
    . ~/.huskyrc
  fi
fi
