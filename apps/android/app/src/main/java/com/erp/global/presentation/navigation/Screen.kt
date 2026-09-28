package com.erp.global.presentation.navigation

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object Login : Screen("login")
    object MainShell : Screen("main_shell")
    object Dashboard : Screen("dashboard")
    object Organizations : Screen("organizations")
    object Companies : Screen("companies")
    object Branches : Screen("branches")
    object Warehouses : Screen("warehouses")
    object Users : Screen("users")
    object Settings : Screen("settings")
}
