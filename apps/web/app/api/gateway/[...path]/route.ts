import { NextRequest, NextResponse } from "next/server";
import {
  getGatewayApiBaseUrl,
  isServerAdminAuthConfigured,
  withGatewayAdminAuth,
} from "../../../../lib/server-auth";

function normalizePath(pathParts: string[] | undefined): string {
  if (!pathParts || pathParts.length === 0) return "";
  return pathParts.join("/");
}

async function proxyToGateway(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  if (!isServerAdminAuthConfigured()) {
    return NextResponse.json(
      {
        error: "Server admin auth not configured",
        message:
          "Set BOOTSTRAP_ADMIN_TOKEN in web environment to enable admin console API proxy.",
      },
      { status: 503 }
    );
  }

  const { path } = await context.params;
  const targetPath = normalizePath(path);
  const targetUrl = `${getGatewayApiBaseUrl()}/api/${targetPath}${request.nextUrl.search}`;

  const headers = withGatewayAdminAuth(
    request.headers.get("content-type")
      ? { "content-type": request.headers.get("content-type") as string }
      : undefined
  );

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.text() : undefined;

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  return proxyToGateway(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  return proxyToGateway(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  return proxyToGateway(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  return proxyToGateway(request, context);
}
