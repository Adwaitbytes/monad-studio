import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface DeploymentRecord {
  id: string;
  address: string;
  contractName: string;
  deployer: string;
  network: string;
  timestamp: string;
  gasUsed?: string;
  txHash?: string;
  template?: string;
}

const ANALYTICS_FILE = path.join(process.cwd(), "data", "analytics.json");

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(ANALYTICS_FILE)) {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify({ deployments: [], users: {} }, null, 2));
  }
}

// Read analytics data
function readAnalytics() {
  ensureDataDirectory();
  const data = fs.readFileSync(ANALYTICS_FILE, "utf-8");
  return JSON.parse(data);
}

// Write analytics data
function writeAnalytics(data: any) {
  ensureDataDirectory();
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
}

/**
 * GET /api/analytics - Fetch deployment statistics
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get("userAddress");
    const network = searchParams.get("network");
    
    const analytics = readAnalytics();
    const deployments: DeploymentRecord[] = analytics.deployments || [];
    
    // Filter by user or network if provided
    let filteredDeployments = deployments;
    if (userAddress) {
      filteredDeployments = deployments.filter(d => d.deployer.toLowerCase() === userAddress.toLowerCase());
    }
    if (network) {
      filteredDeployments = deployments.filter(d => d.network === network);
    }
    
    // Calculate statistics
    const stats = {
      totalDeployments: deployments.length,
      userDeployments: userAddress ? filteredDeployments.length : null,
      networkBreakdown: {
        testnet: deployments.filter(d => d.network === "testnet").length,
        mainnet: deployments.filter(d => d.network === "mainnet").length
      },
      templateUsage: {} as Record<string, number>,
      recentDeployments: deployments.slice(-10).reverse(),
      uniqueUsers: Object.keys(analytics.users || {}).length,
      last24Hours: deployments.filter(d => {
        const deployTime = new Date(d.timestamp).getTime();
        const now = Date.now();
        return now - deployTime < 24 * 60 * 60 * 1000;
      }).length
    };
    
    // Count template usage
    deployments.forEach(d => {
      if (d.template) {
        stats.templateUsage[d.template] = (stats.templateUsage[d.template] || 0) + 1;
      }
    });
    
    // User-specific stats
    if (userAddress && analytics.users[userAddress.toLowerCase()]) {
      const userData = analytics.users[userAddress.toLowerCase()];
      (stats as any).userStats = {
        firstDeployment: userData.firstDeployment,
        totalGasUsed: userData.totalGasUsed || "0",
        favoriteTemplate: userData.favoriteTemplate || null,
        deploymentHistory: filteredDeployments
      };
    }
    
    return NextResponse.json({
      success: true,
      stats,
      deployments: filteredDeployments
    });
    
  } catch (error: any) {
    console.error("Analytics GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/analytics - Record a new deployment
 */
export async function POST(req: Request) {
  try {
    const deployment: DeploymentRecord = await req.json();
    
    // Validate required fields
    if (!deployment.address || !deployment.deployer || !deployment.network) {
      return NextResponse.json({ 
        error: "Missing required fields: address, deployer, network" 
      }, { status: 400 });
    }
    
    const analytics = readAnalytics();
    
    // Add deployment record
    const newDeployment = {
      ...deployment,
      id: deployment.id || `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: deployment.timestamp || new Date().toISOString()
    };
    
    analytics.deployments = analytics.deployments || [];
    analytics.deployments.push(newDeployment);
    
    // Update user stats
    const userKey = deployment.deployer.toLowerCase();
    if (!analytics.users) analytics.users = {};
    if (!analytics.users[userKey]) {
      analytics.users[userKey] = {
        address: deployment.deployer,
        firstDeployment: newDeployment.timestamp,
        totalDeployments: 0,
        totalGasUsed: "0",
        templates: {}
      };
    }
    
    analytics.users[userKey].totalDeployments++;
    analytics.users[userKey].lastDeployment = newDeployment.timestamp;
    
    if (deployment.gasUsed) {
      const currentGas = BigInt(analytics.users[userKey].totalGasUsed || "0");
      const newGas = BigInt(deployment.gasUsed);
      analytics.users[userKey].totalGasUsed = (currentGas + newGas).toString();
    }
    
    if (deployment.template) {
      analytics.users[userKey].templates = analytics.users[userKey].templates || {};
      analytics.users[userKey].templates[deployment.template] = 
        (analytics.users[userKey].templates[deployment.template] || 0) + 1;
      
      // Determine favorite template
      const templates = analytics.users[userKey].templates;
      const favorite = Object.keys(templates).reduce((a, b) => 
        templates[a] > templates[b] ? a : b
      );
      analytics.users[userKey].favoriteTemplate = favorite;
    }
    
    writeAnalytics(analytics);
    
    return NextResponse.json({
      success: true,
      deployment: newDeployment,
      message: "Deployment recorded successfully"
    });
    
  } catch (error: any) {
    console.error("Analytics POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/analytics - Clear analytics data (admin only)
 */
export async function DELETE() {
  try {
    writeAnalytics({ deployments: [], users: {} });
    return NextResponse.json({
      success: true,
      message: "Analytics data cleared"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
