CREATE TABLE "media_assets" (
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"style" text NOT NULL,
	"mime_type" text NOT NULL,
	"data" bytea NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "media_assets_kind_key_style_pk" PRIMARY KEY("kind","key","style")
);
