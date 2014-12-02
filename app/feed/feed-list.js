'use strict';

angular.module('app.feed-list', [
        'ngLodash',
        'ui.router',
        'xc.indexedDB',
        'app.common-auth'
    ])
    .config(function config($stateProvider) {
        $stateProvider.state('feed-list', {
            url: '/feeds/list',
            views: {
                "main": {
                    controller: 'FeedListCtrl',
                    templateUrl: 'app/feed/feed-list.tpl.html'
                }
            },
            data: {
                pageTitle: 'All Feeds'
            }
        });
    })
    .controller('FeedListCtrl', FeedListController);

FeedListController.$inject = ['$scope', '$http', '$indexedDB', '$rootScope', '$state', 'lodash', 'AuthUtil'];

function FeedListController($scope, $http, $indexedDB, $rootScope, $state, lodash, AuthUtil) {
    var feedStore = $indexedDB.objectStore('feeds')

    feedStore.getAll().then(function(results) {
        $scope.feedData = results;
    });

    $scope.deleteFeed = function(feedId) {
        feedStore.delete(feedId).then(function() {
            Messenger().post("Successfully deleted feed.");

            $scope.feedData = lodash.reject($scope.feedData, {
                _id: feedId
            });
        });
    }

    $scope.userFilter = lodash.partial(AuthUtil.itemFilter, $scope);

    $rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
        if (fromState.name === 'feed-new' || fromState.name === 'feed-edit') {
            feedStore.getAll().then(function(results) {
                $scope.feedData = results;
                $state.reload();
            });
        }
    });

    $(':checkbox').radiocheck();
}