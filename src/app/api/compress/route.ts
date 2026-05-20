// app/api/compress/route.ts
import { NextRequest, NextResponse } from "next/server";
import tinify from "tinify";

tinify.key = process.env.TINYPNG_API_KEY!;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image") as File;

  if (!file) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const compressedUint8 = await tinify.fromBuffer(buffer).toBuffer();
    const compressed = Buffer.from(compressedUint8);

    return new NextResponse(compressed, {
      headers: {
        "Content-Type": file.type,
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "X-Original-Size": buffer.length.toString(),
        "X-Compressed-Size": compressed.length.toString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error compressing image";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
