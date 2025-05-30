# VRM Animations

This directory contains VRM animation files (.vrma) for the 3D character.

## Available Animations

- `idle_loop.vrma` - Default idle animation that loops continuously

## Adding New Animations

Place your .vrma files in this directory. The animation files should be compatible with the VRM model being used.

## Usage

Animations are loaded using the `@pixiv/three-vrm-animation` library. The default idle animation is automatically applied when the character loads.