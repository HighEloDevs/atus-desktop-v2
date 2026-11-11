//! Project persistence and platform integration.

pub mod commands;
#[cfg(target_os = "macos")]
pub mod finder;
#[cfg(target_os = "macos")]
pub mod menu;
mod migrations;
pub mod model;
pub mod store;

#[cfg(test)]
mod tests;
