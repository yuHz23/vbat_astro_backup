import type { Schema, Struct } from '@strapi/strapi';

export interface OrderOrderItem extends Struct.ComponentSchema {
  collectionName: 'components_order_order_items';
  info: {
    description: '';
    displayName: 'OrderItem';
    icon: 'shoppingCart';
  };
  attributes: {
    product: Schema.Attribute.Relation<'oneToOne', 'api::product.product'>;
    quantity: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    unitPrice: Schema.Attribute.Decimal & Schema.Attribute.Required;
    variantInfo: Schema.Attribute.String;
  };
}

export interface ProductProductVariant extends Struct.ComponentSchema {
  collectionName: 'components_product_product_variants';
  info: {
    description: '';
    displayName: 'ProductVariant';
    icon: 'grid';
  };
  attributes: {
    additionalPrice: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    image: Schema.Attribute.Media<'images'>;
    variantName: Schema.Attribute.String & Schema.Attribute.Required;
    variantType: Schema.Attribute.Enumeration<['size', 'color', 'material']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'size'>;
  };
}

export interface SharedSocialLink extends Struct.ComponentSchema {
  collectionName: 'components_shared_social_links';
  info: {
    description: '';
    displayName: 'SocialLink';
    icon: 'link';
  };
  attributes: {
    icon: Schema.Attribute.String;
    platform: Schema.Attribute.String & Schema.Attribute.Required;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'order.order-item': OrderOrderItem;
      'product.product-variant': ProductProductVariant;
      'shared.social-link': SharedSocialLink;
    }
  }
}
