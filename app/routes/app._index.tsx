import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Page, Layout, Card, Button, BlockStack, Text } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return json({
    shop: session.shop,
  });
};

export default function Index() {
  const { shop } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  // Auto-redirect to studio after component mounts (client-side)
  useEffect(() => {
    navigate('/app/studio');
  }, [navigate]);

  return (
    <Page>
      <TitleBar title="Trayve Virtual Try-On" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h1" variant="headingLg">
                    Welcome to Trayve Virtual Try-On
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Create stunning product images with AI-powered virtual try-on technology.
                    Upload your clothing images and generate professional product photos in seconds.
                  </Text>
                </BlockStack>

                <Button
                  variant="primary"
                  onClick={() => navigate('/app/studio')}
                  size="large"
                >
                  Open Virtual Try-On Studio
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  âš¡ Fast Generation
                </Text>
                <Text as="p" variant="bodyMd">
                  Get professional images in under 60 seconds.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  í²Ž High Quality
                </Text>
                <Text as="p" variant="bodyMd">
                  4K resolution images with realistic details.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  í±¥ Diverse Models
                </Text>
                <Text as="p" variant="bodyMd">
                  Choose from a wide range of model types.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  í²° Flexible Pricing
                </Text>
                <Text as="p" variant="bodyMd">
                  Pay only for what you use with credits.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Your Shop
                </Text>
                <Text as="p" variant="bodyMd">
                  Connected to: <strong>{shop}</strong>
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
