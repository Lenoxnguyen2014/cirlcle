import { Duffel } from '@duffel/api';

// Initialize sandbox environments
const duffel = new Duffel({ 
    token: process.env.DUFFEL_TEST_ACCESS_TOKEN // Must start with duffel_test_
});

export { duffel };