package com.erp.global.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class ReportSummaryResponse(
    val success: Boolean,
    val data: ReportSummaryData? = null
)

@Serializable
data class ReportSummaryData(
    val totalRevenue: Double = 0.0,
    val totalServices: TotalServices = TotalServices(),
    val topServices: Map<String, Int> = emptyMap()
)

@Serializable
data class TotalServices(
    val pending: Int = 0,
    val in_progress: Int = 0,
    val ready: Int = 0,
    val delivered: Int = 0
)
