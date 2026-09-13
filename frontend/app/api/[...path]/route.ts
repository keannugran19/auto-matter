import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = (
    process.env.BACKEND_URL || "http://localhost:8000"
).replace(/\/+$/, "");

async function handleProxy(
    request: NextRequest,
    props: { params: Promise<{ path: string[] }> },
) {
    const params = await props.params;
    const pathParts = params.path || [];
    const subPath = pathParts.join("/");

    const targetUrl = new URL(`/api/${subPath}`, BACKEND_URL);
    targetUrl.search = request.nextUrl.search;

    const headers = new Headers();
    request.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        // Do not forward host or connection headers
        if (lowerKey !== "host" && lowerKey !== "connection") {
            headers.set(key, value);
        }
    });

    const method = request.method;
    let body: BodyInit | undefined = undefined;
    if (!["GET", "HEAD"].includes(method)) {
        body = await request.arrayBuffer();
    }

    try {
        const backendResponse = await fetch(targetUrl.toString(), {
            method,
            headers,
            body,
            // @ts-ignore
            duplex: "half",
        });

        const responseHeaders = new Headers();
        backendResponse.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            // Omit transfer-encoding and content-encoding if decompressed
            if (
                lowerKey !== "content-encoding" &&
                lowerKey !== "transfer-encoding"
            ) {
                responseHeaders.set(key, value);
            }
        });

        return new NextResponse(backendResponse.body, {
            status: backendResponse.status,
            statusText: backendResponse.statusText,
            headers: responseHeaders,
        });
    } catch (err: any) {
        console.error(
            `[API Proxy Error] Failed to reach ${targetUrl.toString()}:`,
            err,
        );
        return NextResponse.json(
            {
                error: `Failed to connect to backend service at ${BACKEND_URL}`,
                detail: err.message,
            },
            { status: 502 },
        );
    }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const DELETE = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
