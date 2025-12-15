/**
 * NFT Management Service
 * Comprehensive NFT support for NeuroGrid wallet
 */

const axios = require('axios');
const logger = require('../utils/logger');

class NFTService {
  constructor(config = {}) {
    this.config = {
      openSeaApiKey: config.openSeaApiKey || process.env.OPENSEA_API_KEY,
      alchemyApiKey: config.alchemyApiKey || process.env.ALCHEMY_API_KEY,
      moralisApiKey: config.moralisApiKey || process.env.MORALIS_API_KEY,
      ipfsGateway: config.ipfsGateway || 'https://ipfs.io/ipfs/',
      enableTestnet: config.enableTestnet || process.env.NODE_ENV !== 'production',
      
      // Supported marketplaces
      marketplaces: {
        opensea: {
          enabled: true,
          baseUrl: config.enableTestnet ? 
            'https://testnets-api.opensea.io' : 
            'https://api.opensea.io',
          contractAddresses: {
            seaport: '0x00000000006c3852cbEf3e08E8dF289169EdE581'
          }
        },
        rarible: {
          enabled: true,
          baseUrl: 'https://api.rarible.org'
        },
        foundation: {
          enabled: true,
          baseUrl: 'https://api.foundation.app'
        }
      },
      
      // NFT standards
      standards: {
        ERC721: true,
        ERC1155: true,
        ERC998: false // Composable NFTs - future support
      },
      
      ...config
    };

    this.cache = {
      collections: new Map(),
      metadata: new Map(),
      prices: new Map()
    };

    this.analytics = {
      totalNFTs: 0,
      totalValue: 0,
      collectionsCount: 0,
      userStats: new Map()
    };

    this.init();
  }

  init() {
    this.setupMetadataCache();
    this.setupPriceTracking();
    
    logger.info('NFT Service initialized', {
      marketplaces: Object.keys(this.config.marketplaces).filter(m => this.config.marketplaces[m].enabled),
      standards: Object.keys(this.config.standards).filter(s => this.config.standards[s]),
      testnet: this.config.enableTestnet
    });
  }

  /**
   * Get user's NFT portfolio
   */
  async getUserNFTPortfolio(userAddress) {
    try {
      const portfolio = {
        totalNFTs: 0,
        totalEstimatedValue: 0,
        collections: [],
        recentActivity: [],
        topCollections: [],
        analytics: {}
      };

      // Get NFTs from multiple sources
      const nfts = await this.getUserNFTs(userAddress);
      portfolio.totalNFTs = nfts.length;

      // Group by collections
      const collectionMap = new Map();
      
      for (const nft of nfts) {
        const collectionId = nft.contract.address;
        
        if (!collectionMap.has(collectionId)) {
          collectionMap.set(collectionId, {
            contract: nft.contract,
            items: [],
            floorPrice: 0,
            totalValue: 0
          });
        }
        
        collectionMap.get(collectionId).items.push(nft);
      }

      // Process collections
      for (const [collectionId, collection] of collectionMap) {
        // Get collection metadata and floor price
        const metadata = await this.getCollectionMetadata(collectionId);
        const floorPrice = await this.getCollectionFloorPrice(collectionId);
        
        collection.name = metadata.name;
        collection.description = metadata.description;
        collection.floorPrice = floorPrice;
        collection.totalValue = collection.items.length * floorPrice;
        
        portfolio.totalEstimatedValue += collection.totalValue;
        portfolio.collections.push(collection);
      }

      // Sort collections by value
      portfolio.collections.sort((a, b) => b.totalValue - a.totalValue);
      portfolio.topCollections = portfolio.collections.slice(0, 5);

      // Get recent activity
      portfolio.recentActivity = await this.getUserNFTActivity(userAddress, 10);

      // Calculate analytics
      portfolio.analytics = this.calculatePortfolioAnalytics(portfolio);

      return portfolio;

    } catch (error) {
      logger.error('Failed to get NFT portfolio', { error: error.message, userAddress });
      throw error;
    }
  }

  /**
   * Get user's NFTs from blockchain
   */
  async getUserNFTs(userAddress) {
    try {
      const allNFTs = [];

      // Use Alchemy API for comprehensive NFT data
      if (this.config.alchemyApiKey) {
        const alchemyNFTs = await this.getNFTsFromAlchemy(userAddress);
        allNFTs.push(...alchemyNFTs);
      }

      // Use Moralis as backup/additional source
      if (this.config.moralisApiKey && allNFTs.length === 0) {
        const moralisNFTs = await this.getNFTsFromMoralis(userAddress);
        allNFTs.push(...moralisNFTs);
      }

      // Enhance with metadata
      for (const nft of allNFTs) {
        nft.metadata = await this.getNFTMetadata(nft.contract.address, nft.tokenId);
        nft.estimatedValue = await this.estimateNFTValue(nft);
      }

      return allNFTs;

    } catch (error) {
      logger.error('Failed to get user NFTs', { error: error.message, userAddress });
      return [];
    }
  }

  /**
   * Get NFTs using Alchemy API
   */
  async getNFTsFromAlchemy(userAddress) {
    try {
      const response = await axios.get(
        `https://eth-mainnet.g.alchemy.com/v2/${this.config.alchemyApiKey}/getNFTs/`,
        {
          params: {
            owner: userAddress,
            withMetadata: true,
            pageSize: 100
          }
        }
      );

      return response.data.ownedNfts.map(nft => ({
        contract: {
          address: nft.contract.address,
          name: nft.contractMetadata?.name || 'Unknown',
          symbol: nft.contractMetadata?.symbol || '',
          tokenType: nft.contractMetadata?.tokenType || 'ERC721'
        },
        tokenId: nft.id.tokenId,
        tokenUri: nft.tokenUri?.raw,
        metadata: nft.metadata,
        image: nft.metadata?.image,
        name: nft.metadata?.name || `#${nft.id.tokenId}`,
        description: nft.metadata?.description,
        attributes: nft.metadata?.attributes || []
      }));

    } catch (error) {
      logger.error('Failed to get NFTs from Alchemy', { error: error.message });
      return [];
    }
  }

  /**
   * Get NFT metadata with IPFS support
   */
  async getNFTMetadata(contractAddress, tokenId) {
    try {
      const cacheKey = `${contractAddress}:${tokenId}`;
      
      if (this.cache.metadata.has(cacheKey)) {
        return this.cache.metadata.get(cacheKey);
      }

      // First try to get metadata from token URI
      const tokenUri = await this.getTokenURI(contractAddress, tokenId);
      
      if (!tokenUri) {
        return this.getDefaultMetadata(contractAddress, tokenId);
      }

      let metadataUrl = tokenUri;
      
      // Handle IPFS URLs
      if (tokenUri.startsWith('ipfs://')) {
        metadataUrl = tokenUri.replace('ipfs://', this.config.ipfsGateway);
      }

      const response = await axios.get(metadataUrl, { timeout: 10000 });
      const metadata = response.data;

      // Process image URL if it's IPFS
      if (metadata.image && metadata.image.startsWith('ipfs://')) {
        metadata.image = metadata.image.replace('ipfs://', this.config.ipfsGateway);
      }

      // Cache metadata
      this.cache.metadata.set(cacheKey, metadata);
      
      // Cleanup cache if it gets too large
      if (this.cache.metadata.size > 1000) {
        const firstKey = this.cache.metadata.keys().next().value;
        this.cache.metadata.delete(firstKey);
      }

      return metadata;

    } catch (error) {
      logger.error('Failed to get NFT metadata', { 
        error: error.message, 
        contractAddress, 
        tokenId 
      });
      return this.getDefaultMetadata(contractAddress, tokenId);
    }
  }

  /**
   * Estimate NFT value using multiple sources
   */
  async estimateNFTValue(nft) {
    try {
      // Get collection floor price
      const floorPrice = await this.getCollectionFloorPrice(nft.contract.address);
      
      // Get recent sales data
      const recentSales = await this.getRecentSales(nft.contract.address, 10);
      
      // Calculate rarity-based multiplier
      const rarityMultiplier = this.calculateRarityMultiplier(nft);
      
      // Estimate value
      let estimatedValue = floorPrice;
      
      if (recentSales.length > 0) {
        const avgSalePrice = recentSales.reduce((sum, sale) => sum + sale.price, 0) / recentSales.length;
        estimatedValue = Math.max(floorPrice, avgSalePrice * 0.8); // Conservative estimate
      }
      
      estimatedValue *= rarityMultiplier;

      return {
        estimatedValue: estimatedValue,
        floorPrice: floorPrice,
        rarityMultiplier: rarityMultiplier,
        confidence: recentSales.length > 3 ? 'high' : 'medium',
        lastUpdated: Date.now()
      };

    } catch (error) {
      logger.error('Failed to estimate NFT value', { error: error.message });
      return {
        estimatedValue: 0,
        floorPrice: 0,
        rarityMultiplier: 1,
        confidence: 'low',
        lastUpdated: Date.now()
      };
    }
  }

  /**
   * Get collection floor price from OpenSea
   */
  async getCollectionFloorPrice(contractAddress) {
    try {
      const cacheKey = `floor_${contractAddress}`;
      
      if (this.cache.prices.has(cacheKey)) {
        const cached = this.cache.prices.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
          return cached.price;
        }
      }

      const response = await axios.get(
        `${this.config.marketplaces.opensea.baseUrl}/api/v1/collection/${contractAddress}/stats`,
        {
          headers: this.config.openSeaApiKey ? {
            'X-API-KEY': this.config.openSeaApiKey
          } : {}
        }
      );

      const floorPrice = response.data.stats.floor_price || 0;
      
      // Cache the price
      this.cache.prices.set(cacheKey, {
        price: floorPrice,
        timestamp: Date.now()
      });

      return floorPrice;

    } catch (error) {
      logger.error('Failed to get floor price', { error: error.message, contractAddress });
      return 0;
    }
  }

  /**
   * List NFT for sale
   */
  async listNFTForSale(userAddress, nft, listingDetails) {
    try {
      const { price, duration, marketplace } = listingDetails;
      
      if (!this.config.marketplaces[marketplace]?.enabled) {
        throw new Error(`Marketplace ${marketplace} is not supported`);
      }

      let result;

      switch (marketplace) {
        case 'opensea':
          result = await this.listOnOpenSea(userAddress, nft, price, duration);
          break;
        case 'rarible':
          result = await this.listOnRarible(userAddress, nft, price, duration);
          break;
        default:
          throw new Error(`Listing on ${marketplace} not implemented`);
      }

      // Track listing
      this.trackNFTListing(nft, listingDetails, result);

      logger.info('NFT listed for sale', {
        marketplace,
        contract: nft.contract.address,
        tokenId: nft.tokenId,
        price
      });

      return result;

    } catch (error) {
      logger.error('Failed to list NFT', { error: error.message });
      throw error;
    }
  }

  /**
   * Buy NFT from marketplace
   */
  async buyNFT(userAddress, nftListing, privateKey) {
    try {
      const { marketplace, contract, tokenId, price } = nftListing;
      
      let transactionHash;

      switch (marketplace) {
        case 'opensea':
          transactionHash = await this.buyFromOpenSea(userAddress, nftListing, privateKey);
          break;
        case 'rarible':
          transactionHash = await this.buyFromRarible(userAddress, nftListing, privateKey);
          break;
        default:
          throw new Error(`Buying from ${marketplace} not implemented`);
      }

      // Track purchase
      this.trackNFTPurchase(nftListing, transactionHash);

      logger.info('NFT purchased', {
        marketplace,
        contract,
        tokenId,
        price,
        transactionHash
      });

      return {
        success: true,
        transactionHash,
        marketplace,
        contract,
        tokenId,
        price
      };

    } catch (error) {
      logger.error('Failed to buy NFT', { error: error.message });
      throw error;
    }
  }

  /**
   * Transfer NFT to another address
   */
  async transferNFT(fromAddress, toAddress, nft, privateKey) {
    try {
      // This would implement the actual blockchain transaction
      const transactionHash = await this.executeNFTTransfer(
        fromAddress, 
        toAddress, 
        nft.contract.address, 
        nft.tokenId, 
        privateKey
      );

      logger.info('NFT transferred', {
        from: fromAddress,
        to: toAddress,
        contract: nft.contract.address,
        tokenId: nft.tokenId,
        transactionHash
      });

      return {
        success: true,
        transactionHash,
        from: fromAddress,
        to: toAddress,
        nft
      };

    } catch (error) {
      logger.error('Failed to transfer NFT', { error: error.message });
      throw error;
    }
  }

  /**
   * Get NFT market trends
   */
  async getMarketTrends(timeframe = '7d') {
    try {
      const trends = {
        timeframe,
        totalVolume: 0,
        totalSales: 0,
        averagePrice: 0,
        topCollections: [],
        priceChanges: {},
        marketplaces: {}
      };

      // Get data from OpenSea API
      const response = await axios.get(
        `${this.config.marketplaces.opensea.baseUrl}/api/v1/stats`,
        {
          headers: this.config.openSeaApiKey ? {
            'X-API-KEY': this.config.openSeaApiKey
          } : {}
        }
      );

      if (response.data) {
        trends.totalVolume = response.data.total_volume || 0;
        trends.totalSales = response.data.total_sales || 0;
        trends.averagePrice = response.data.average_price || 0;
      }

      return trends;

    } catch (error) {
      logger.error('Failed to get market trends', { error: error.message });
      return {
        timeframe,
        totalVolume: 0,
        totalSales: 0,
        averagePrice: 0,
        topCollections: [],
        priceChanges: {},
        marketplaces: {}
      };
    }
  }

  /**
   * Helper methods
   */

  setupMetadataCache() {
    // Clean cache periodically
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.metadata.entries()) {
        if (now - (value.lastAccessed || 0) > 3600000) { // 1 hour
          this.cache.metadata.delete(key);
        }
      }
    }, 300000); // Every 5 minutes
  }

  setupPriceTracking() {
    // Update popular collection prices periodically
    setInterval(async () => {
      try {
        await this.updatePopularCollectionPrices();
      } catch (error) {
        logger.error('Failed to update collection prices', { error: error.message });
      }
    }, 600000); // Every 10 minutes
  }

  calculateRarityMultiplier(nft) {
    if (!nft.attributes || nft.attributes.length === 0) {
      return 1;
    }

    // Simple rarity calculation based on trait frequency
    let rarityScore = 1;
    
    for (const attribute of nft.attributes) {
      // Mock rarity calculation - in production, use actual trait frequencies
      const traitRarity = Math.random() * 0.5 + 0.5; // 0.5 - 1.0
      rarityScore *= (1 / traitRarity);
    }

    // Cap the multiplier to prevent extreme values
    return Math.min(rarityScore, 10);
  }

  calculatePortfolioAnalytics(portfolio) {
    return {
      diversification: this.calculateDiversification(portfolio.collections),
      averageHoldTime: this.calculateAverageHoldTime(portfolio.collections),
      profitLoss: this.calculateProfitLoss(portfolio.collections),
      riskScore: this.calculateRiskScore(portfolio.collections)
    };
  }

  getDefaultMetadata(contractAddress, tokenId) {
    return {
      name: `Token #${tokenId}`,
      description: 'NFT metadata unavailable',
      image: null,
      attributes: []
    };
  }

  // Mock implementations for demonstration
  async getTokenURI() { return null; }
  async getCollectionMetadata(address) { 
    return { name: 'Unknown Collection', description: 'Collection metadata unavailable' }; 
  }
  async getUserNFTActivity() { return []; }
  async getRecentSales() { return []; }
  async getNFTsFromMoralis() { return []; }
  
  async listOnOpenSea() { return { success: true, listingId: 'mock_listing' }; }
  async listOnRarible() { return { success: true, listingId: 'mock_listing' }; }
  
  async buyFromOpenSea() { return 'mock_tx_hash'; }
  async buyFromRarible() { return 'mock_tx_hash'; }
  
  async executeNFTTransfer() { return 'mock_tx_hash'; }
  
  async updatePopularCollectionPrices() { /* Mock implementation */ }
  
  calculateDiversification() { return 0.7; }
  calculateAverageHoldTime() { return 90; } // days
  calculateProfitLoss() { return 0.15; } // 15% profit
  calculateRiskScore() { return 0.6; } // medium risk

  trackNFTListing(nft, listingDetails, result) {
    // Track listing analytics
  }

  trackNFTPurchase(nftListing, transactionHash) {
    // Track purchase analytics
  }

  /**
   * Get analytics and statistics
   */
  getAnalytics() {
    return {
      totalNFTs: this.analytics.totalNFTs,
      totalValue: this.analytics.totalValue,
      collectionsCount: this.analytics.collectionsCount,
      supportedMarketplaces: Object.keys(this.config.marketplaces).filter(m => this.config.marketplaces[m].enabled),
      supportedStandards: Object.keys(this.config.standards).filter(s => this.config.standards[s])
    };
  }
}

module.exports = NFTService;