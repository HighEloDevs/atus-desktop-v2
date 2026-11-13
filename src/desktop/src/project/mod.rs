//! Project persistence and platform integration.

pub mod commands;
#[cfg(feature = "desktop-e2e")]
pub mod e2e;
#[cfg(target_os = "macos")]
pub mod finder;
pub mod manage;
#[cfg(target_os = "macos")]
pub mod menu;
mod migrations;
pub mod model;
pub mod store;

#[cfg(test)]
mod test_support;
