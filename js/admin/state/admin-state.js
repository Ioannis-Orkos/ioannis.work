export function createAdminState() {
  return {
    isLoading: false,
    overview: null,
    users: [],
    accessRequests: [],
    contentItems: [],
    userSearchQuery: "",
    userRoleFilter: "all",
    requestFilter: "pending",
    requestSearchQuery: "",
    hasLoaded: false,
    activeTab: "users",
  };
}
