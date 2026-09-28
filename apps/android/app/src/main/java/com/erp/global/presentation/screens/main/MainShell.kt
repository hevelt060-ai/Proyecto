package com.erp.global.presentation.screens.main

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.HomeWork
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Store
import androidx.compose.material.icons.filled.Warehouse
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.erp.global.presentation.navigation.Screen

data class NavigationItem(
    val title: String,
    val icon: ImageVector,
    val route: String
)

val navigationItems = listOf(
    NavigationItem("Dashboard", Icons.Default.Dashboard, Screen.Dashboard.route),
    NavigationItem("Organizations", Icons.Default.Business, Screen.Organizations.route),
    NavigationItem("Companies", Icons.Default.HomeWork, Screen.Companies.route),
    NavigationItem("Branches", Icons.Default.Store, Screen.Branches.route),
    NavigationItem("Warehouses", Icons.Default.Warehouse, Screen.Warehouses.route),
    NavigationItem("Users", Icons.Default.People, Screen.Users.route),
    NavigationItem("Settings", Icons.Default.Settings, Screen.Settings.route)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainShell(
    windowSizeClass: WindowSizeClass,
    onLogout: () -> Unit
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val isCompact = windowSizeClass.widthSizeClass == WindowWidthSizeClass.Compact

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ERP Global") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                ),
                actions = {
                    androidx.compose.material3.IconButton(onClick = { /* TODO GlobalSearch */ }) {
                        Icon(androidx.compose.material.icons.Icons.Default.Search, contentDescription = "Search")
                    }
                    androidx.compose.material3.IconButton(onClick = { /* TODO TenantSelector */ }) {
                        Icon(androidx.compose.material.icons.Icons.Default.Business, contentDescription = "Tenant")
                    }
                    androidx.compose.material3.IconButton(onClick = { /* TODO UserMenu */ }) {
                        Icon(androidx.compose.material.icons.Icons.Default.AccountCircle, contentDescription = "User")
                    }
                }
            )
        },
        bottomBar = {
            if (isCompact) {
                NavigationBar {
                    navigationItems.take(4).forEach { item ->
                        NavigationBarItem(
                            icon = { Icon(item.icon, contentDescription = item.title) },
                            label = { Text(item.title) },
                            selected = currentRoute == item.route,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.startDestinationId)
                                    launchSingleTop = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (!isCompact) {
                NavigationRail {
                    navigationItems.forEach { item ->
                        NavigationRailItem(
                            icon = { Icon(item.icon, contentDescription = item.title) },
                            label = { Text(item.title) },
                            selected = currentRoute == item.route,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.startDestinationId)
                                    launchSingleTop = true
                                }
                            }
                        )
                    }
                }
            }
            
            Box(modifier = Modifier.fillMaxSize()) {
                AppNavigation(navController)
            }
        }
    }
}

@Composable
fun AppNavigation(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Screen.Dashboard.route
    ) {
        composable(Screen.Dashboard.route) {
            Box(Modifier.fillMaxSize()) { Text("Dashboard Placeholder") }
        }
        composable(Screen.Organizations.route) {
            Box(Modifier.fillMaxSize()) { Text("Organizations Placeholder") }
        }
        composable(Screen.Companies.route) {
            Box(Modifier.fillMaxSize()) { Text("Companies Placeholder") }
        }
        composable(Screen.Branches.route) {
            Box(Modifier.fillMaxSize()) { Text("Branches Placeholder") }
        }
        composable(Screen.Warehouses.route) {
            Box(Modifier.fillMaxSize()) { Text("Warehouses Placeholder") }
        }
        composable(Screen.Users.route) {
            Box(Modifier.fillMaxSize()) { Text("Users Placeholder") }
        }
        composable(Screen.Settings.route) {
            Box(Modifier.fillMaxSize()) { Text("Settings Placeholder") }
        }
    }
}
